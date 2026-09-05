import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { CONCEPT_RE } from "@/lib/concepts";

/** Nome do evento disparado ao clicar num conceito reconhecido — note-editor.tsx escuta e navega pra /conceitos. */
export const CONCEPT_STUDY_EVENT = "khrov:goto-concept";

/** Badge pequeno e discreto — só indicador visual, quem responde ao clique é o handleClick do plugin. */
function badgeWidget() {
  const span = document.createElement("span");
  span.className = "concept-badge";
  span.contentEditable = "false";
  span.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  return span;
}

// Entra no lugar do separador escondido — "Termo → Definição", visual de
// glossário limpo (ex: RemNote), em vez de só remover os ":" e deixar
// tudo grudado ou com um espaço mudo sem indicar nada.
function arrowWidget() {
  const span = document.createElement("span");
  span.className = "concept-arrow";
  span.contentEditable = "false";
  span.textContent = " → ";
  return span;
}

function matchConceptAt(node: ProseMirrorNode) {
  const raw = node.textContent;
  const text = raw.trim();
  if (!text) return null;
  const match = CONCEPT_RE.exec(text);
  if (!match) return null;
  const term = match[1].trim();
  if (!term) return null;
  // Onde o separador (":", "::", ou ": :" com espaço) começa e termina
  // dentro de `raw` — só ELE fica escondido (a sintaxe em si). "+1" pula
  // o ":" inicial (fora do grupo 1); o fim do separador é onde o grupo 2
  // (definição) de fato começa, sobrando o resto do texto sempre visível
  // — a nota não pode virar só o termo sem a definição junto.
  const leadingTrim = raw.indexOf(text);
  const hideFrom = leadingTrim + 1 + match[1].length;
  const hideTo = leadingTrim + (text.length - match[2].length);
  return { term, definition: match[2].trim(), raw, hideFrom, hideTo };
}

/**
 * Reconhece parágrafos com a sintaxe de conceito (`:Termo::Definição`,
 * ver src/lib/concepts.ts) e, enquanto o editor não está com o cursor
 * naquela linha, esconde só a sintaxe (o `:` inicial e o separador do
 * meio) — termo E definição continuam visíveis como texto normal da
 * nota (uma nota não pode virar só "Termo" sem o resto). Ganha um
 * sublinhado pontilhado discreto + badge indicando que é um conceito
 * clicável (leva pro glossário). Ao focar a linha pra editar (clique numa
 * linha já focada, ou navegação por teclado), volta a mostrar a sintaxe
 * crua. Mesmo mecanismo de foco real que flashcard-highlight-extension.ts usa.
 */
export const ConceptHighlight = Extension.create({
  name: "conceptHighlight",

  addProseMirrorPlugins() {
    const key = new PluginKey<{ hasFocus: boolean }>("conceptHighlight");

    return [
      new Plugin({
        key,
        state: {
          init: () => ({ hasFocus: false }),
          apply(tr, prev) {
            const meta = tr.getMeta(key) as { hasFocus: boolean } | undefined;
            return meta ? meta : prev;
          },
        },
        view(editorView) {
          const onFocus = () => editorView.dispatch(editorView.state.tr.setMeta(key, { hasFocus: true }));
          const onBlur = () => editorView.dispatch(editorView.state.tr.setMeta(key, { hasFocus: false }));
          editorView.dom.addEventListener("focus", onFocus);
          editorView.dom.addEventListener("blur", onBlur);
          return {
            destroy() {
              editorView.dom.removeEventListener("focus", onFocus);
              editorView.dom.removeEventListener("blur", onBlur);
            },
          };
        },
        props: {
          // Mesma lógica do FlashcardHighlight: clique numa linha de conceito
          // ainda recolhida (não focada) navega pro glossário; clique numa
          // linha já focada (editando) posiciona o cursor normal.
          handleClick(view: EditorView, pos: number) {
            const hadFocus = key.getState(view.state)?.hasFocus ?? false;
            const { from: selFrom, to: selTo } = view.state.selection;

            const $pos = view.state.doc.resolve(pos);
            if ($pos.parent.type.name !== "paragraph") return false;

            const concept = matchConceptAt($pos.parent);
            if (!concept) return false;

            const nodeFrom = $pos.before($pos.depth);
            const nodeTo = nodeFrom + $pos.parent.nodeSize;
            const wasFocused = hadFocus && selFrom < nodeTo && selTo > nodeFrom;
            if (wasFocused) return false;

            window.dispatchEvent(new CustomEvent(CONCEPT_STUDY_EVENT, { detail: { term: concept.term } }));
            return true;
          },
          decorations(state) {
            const decorations: Decoration[] = [];
            const { hasFocus } = key.getState(state) ?? { hasFocus: false };
            const { from: selFrom, to: selTo } = state.selection;

            state.doc.forEach((node: ProseMirrorNode, offset: number) => {
              if (node.type.name !== "paragraph") return;
              const concept = matchConceptAt(node);
              if (!concept) return;
              const { term, hideFrom, hideTo } = concept;

              const nodeFrom = offset;
              const nodeTo = offset + node.nodeSize;
              const isFocused = hasFocus && selFrom < nodeTo && selTo > nodeFrom;
              const paraStart = offset + 1;

              decorations.push(
                Decoration.node(nodeFrom, nodeTo, {
                  class: `concept-line${isFocused ? " concept-editing" : ""}`,
                  title: `Abrir "${term}" no glossário`,
                })
              );

              if (!isFocused) {
                // Esconde só a sintaxe — o ":" inicial e o separador
                // (":", "::" ou variantes com espaço, ver hideFrom/hideTo em
                // matchConceptAt) — o termo E a definição continuam
                // visíveis, termo em negrito e uma seta no lugar do
                // separador (visual de glossário, tipo RemNote).
                decorations.push(
                  Decoration.inline(paraStart, paraStart + 1, { class: "concept-hidden" })
                );
                decorations.push(
                  Decoration.inline(paraStart + 1, paraStart + hideFrom, { class: "concept-term" })
                );
                decorations.push(
                  Decoration.inline(paraStart + hideFrom, paraStart + hideTo, {
                    class: "concept-hidden",
                  })
                );
                decorations.push(Decoration.widget(paraStart + hideTo, arrowWidget, { side: -1 }));
                decorations.push(Decoration.widget(nodeTo - 1, badgeWidget, { side: 1 }));
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
