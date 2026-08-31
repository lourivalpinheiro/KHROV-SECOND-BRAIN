import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { CONCEPT_RE } from "@/lib/concepts";

/** Nome do evento disparado ao clicar num conceito reconhecido — note-editor.tsx escuta e navega pra /conceitos. */
export const CONCEPT_STUDY_EVENT = "khrov:goto-concept";

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Badge pequeno e discreto — só indicador visual, quem responde ao clique é o handleClick do plugin. */
function badgeWidget() {
  const span = document.createElement("span");
  span.className = "concept-badge";
  span.contentEditable = "false";
  span.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  return span;
}

function matchConceptAt(node: ProseMirrorNode) {
  const text = node.textContent.trim();
  if (!text) return null;
  const match = CONCEPT_RE.exec(text);
  if (!match) return null;
  const term = match[1].trim();
  if (!term) return null;
  return { term, definition: match[2].trim(), raw: node.textContent };
}

/**
 * Reconhece parágrafos com a sintaxe de conceito (`:Termo::Definição`,
 * ver src/lib/concepts.ts) e, enquanto o editor não está com o cursor
 * naquela linha, esconde o `:` inicial e o `::Definição` — sobra só o
 * termo, como texto normal (sem estilo de callout), com um badge
 * discreto, tooltip nativo mostrando a definição completa, e CLIQUE NO
 * TEXTO leva pro glossário. Ao focar a linha pra editar (clique numa
 * linha já focada, ou navegação por teclado), volta a mostrar tudo cru.
 * Mesmo mecanismo de foco real que flashcard-highlight-extension.ts usa.
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
              const { term, definition, raw } = concept;

              const nodeFrom = offset;
              const nodeTo = offset + node.nodeSize;
              const isFocused = hasFocus && selFrom < nodeTo && selTo > nodeFrom;
              const paraStart = offset + 1;

              decorations.push(
                Decoration.node(nodeFrom, nodeTo, {
                  class: `concept-line${isFocused ? " concept-editing" : ""}`,
                  title: definition ? `${term}\n${clip(definition, 140)}` : term,
                })
              );

              if (!isFocused) {
                // Esconde o ":" inicial e, a partir do "::", o resto — sobra só o termo.
                const doubleColonIdx = raw.indexOf("::", raw.indexOf(term));
                decorations.push(
                  Decoration.inline(paraStart, paraStart + 1, { class: "concept-hidden" })
                );
                if (doubleColonIdx !== -1) {
                  decorations.push(
                    Decoration.inline(paraStart + doubleColonIdx, paraStart + raw.length, {
                      class: "concept-hidden",
                    })
                  );
                }
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
