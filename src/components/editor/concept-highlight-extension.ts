import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { CONCEPT_RE } from "@/lib/concepts";

/** Nome do evento disparado ao clicar num conceito reconhecido — note-editor.tsx escuta e navega pra /conceitos. */
export const CONCEPT_STUDY_EVENT = "khrov:goto-concept";

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function conceptGotoWidget(term: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "concept-goto";
  button.title = "Ver no glossário";
  button.contentEditable = "false";
  button.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  button.addEventListener("mousedown", (e) => e.preventDefault());
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent(CONCEPT_STUDY_EVENT, { detail: { term } }));
  });
  return button;
}

/**
 * Reconhece parágrafos com a sintaxe de conceito (`:Termo::Definição`,
 * ver src/lib/concepts.ts) e, enquanto o editor não está com o cursor
 * naquela linha, esconde o `:` inicial e o `::Definição` — sobra só o
 * termo, como texto normal (sem estilo de callout), com tooltip nativo
 * mostrando a definição completa e um ícone pra ir ao glossário. Ao
 * focar a linha pra editar, volta a mostrar tudo cru. Mesmo mecanismo de
 * foco real (via eventos DOM) que flashcard-highlight-extension.ts usa.
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
          decorations(state) {
            const decorations: Decoration[] = [];
            const { hasFocus } = key.getState(state) ?? { hasFocus: false };
            const { from: selFrom, to: selTo } = state.selection;

            state.doc.forEach((node: ProseMirrorNode, offset: number) => {
              if (node.type.name !== "paragraph") return;
              const raw = node.textContent;
              const text = raw.trim();
              if (!text) return;

              const match = CONCEPT_RE.exec(text);
              if (!match) return;
              const term = match[1].trim();
              const definition = match[2].trim();
              if (!term) return;

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
                decorations.push(Decoration.widget(nodeTo - 1, () => conceptGotoWidget(term), { side: 1 }));
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
