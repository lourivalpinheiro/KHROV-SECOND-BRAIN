import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FlashcardNodeView } from "./flashcard-node-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    flashcard: {
      insertFlashcard: () => ReturnType;
    };
  }
}

/**
 * Bloco de flashcard: pergunta + uma ou mais respostas, editados em campos
 * próprios (sem sintaxe de texto tipo "pergunta >> resposta" ficando visível
 * na nota — só os valores digitados, guardados como atributos do node).
 */
export const Flashcard = Node.create({
  name: "flashcard",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      question: { default: "" },
      answers: { default: [""] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="flashcard"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const question = String(node.attrs.question ?? "");
    const answers: string[] = Array.isArray(node.attrs.answers) ? node.attrs.answers : [];
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "flashcard", class: "flashcard-export" }),
      ["p", { class: "flashcard-export-question" }, question],
      ["ul", { class: "flashcard-export-answers" }, ...answers.map((a) => ["li", {}, a])],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FlashcardNodeView);
  },

  addCommands() {
    return {
      insertFlashcard:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { question: "", answers: [""] } })
            .run(),
    };
  },
});
