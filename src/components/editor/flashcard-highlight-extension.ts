import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const CLOZE_RE = /\{\{c(\d+)::(.+?)\}\}/;
const CLOZE_RE_G = /\{\{c\d+::(.+?)\}\}/g;

/** Nome do evento disparado ao clicar no ícone "estudar" de uma linha reconhecida como flashcard — note-editor.tsx escuta e navega pra /flashcards. */
export const FLASHCARD_STUDY_EVENT = "khrov:study-flashcard";

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Pergunta + resposta(s) legíveis, pra usar como tooltip — não precisa ser exato, é só preview. */
function previewFor(kind: "simple" | "multi" | "cloze", text: string): string {
  if (kind === "cloze") {
    const answers = Array.from(text.matchAll(CLOZE_RE_G)).map((m) => m[1]);
    const question = text.replace(CLOZE_RE_G, "[...]");
    return `${clip(question, 90)}\nResposta: ${answers.join(", ")}`;
  }
  if (kind === "multi") {
    return `${clip(text.slice(0, -2).trim(), 90)}\n(várias respostas — veja a lista abaixo)`;
  }
  const [question, answer] = text.split(">>");
  return `${clip(question.trim(), 70)}\nResposta: ${clip((answer ?? "").trim(), 70)}`;
}

/** Botão pequeno "ir pra ele" — SVG desenhado na mão (sem depender de React/lucide, isto é DOM puro dentro do plugin). */
function studyButtonWidget() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flashcard-goto";
  button.title = "Ver nos flashcards";
  button.contentEditable = "false";
  button.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  button.addEventListener("mousedown", (e) => {
    // Impede o clique de mover o cursor do editor pra dentro do texto antes do evento disparar.
    e.preventDefault();
  });
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent(FLASHCARD_STUDY_EVENT));
  });
  return button;
}

/**
 * Destaca visualmente, em tempo real, os parágrafos reconhecidos como
 * flashcard (sintaxe "Pergunta >> Resposta", "Pergunta ==" + lista de
 * respostas abaixo, ou cloze deletion "{{c1::resposta}}") — só CSS/DOM via
 * decorations, não altera o documento. Passa a mão no mouse mostra um
 * preview de pergunta/resposta (tooltip nativo), e um ícone de seta no
 * fim da linha leva pra "Flashcards desta nota" sem interferir no clique
 * normal de posicionar o cursor pra editar.
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

                let kind: "simple" | "multi" | "cloze" | null = null;
                if (CLOZE_RE.test(text)) kind = "cloze";
                else if (text.endsWith("==") && text.length > 2) kind = "multi";
                else if (text.includes(">>")) kind = "simple";

                if (!kind) return;

                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: `flashcard-line flashcard-${kind}`,
                    title: previewFor(kind, text),
                  })
                );
                // Widget no fim do parágrafo (offset + nodeSize - 1 = logo antes do fechamento do node).
                decorations.push(Decoration.widget(offset + node.nodeSize - 1, studyButtonWidget, { side: 1 }));

                if (kind === "multi") lastWasMultiQuestion = true;
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
