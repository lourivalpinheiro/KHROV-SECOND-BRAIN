import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Destaca visualmente, em tempo real, os parágrafos reconhecidos como
 * flashcard (sintaxe "Pergunta >> Resposta" ou "Pergunta ==" + lista de
 * respostas abaixo) — só CSS via decorations, não altera o documento.
 */
export const FlashcardHighlight = Extension.create({
  name: "flashcardHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("flashcardHighlight"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            let lastWasMultiQuestion = false;

            state.doc.forEach((node: ProseMirrorNode, offset: number) => {
              if (node.type.name === "paragraph") {
                const text = node.textContent.trim();
                lastWasMultiQuestion = false;

                if (!text) return;

                if (text.endsWith("==") && text.length > 2) {
                  decorations.push(
                    Decoration.node(offset, offset + node.nodeSize, {
                      class: "flashcard-line flashcard-multi",
                    })
                  );
                  lastWasMultiQuestion = true;
                } else if (text.includes(">>")) {
                  decorations.push(
                    Decoration.node(offset, offset + node.nodeSize, {
                      class: "flashcard-line flashcard-simple",
                    })
                  );
                }
              } else if (
                lastWasMultiQuestion &&
                (node.type.name === "bulletList" || node.type.name === "orderedList")
              ) {
                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: "flashcard-answers",
                  })
                );
                lastWasMultiQuestion = false;
              } else {
                lastWasMultiQuestion = false;
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
