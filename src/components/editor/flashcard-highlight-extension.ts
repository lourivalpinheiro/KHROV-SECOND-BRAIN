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

function clozePlaceholderWidget() {
  const span = document.createElement("span");
  span.className = "flashcard-cloze-blank";
  span.textContent = "[...]";
  span.contentEditable = "false";
  return span;
}

/**
 * Destaca os parágrafos reconhecidos como flashcard (sintaxe
 * "Pergunta >> Resposta", "Pergunta ==" + lista de respostas abaixo, ou
 * cloze deletion "{{c1::resposta}}"). Enquanto o cursor NÃO está naquela
 * linha, esconde a parte de resposta — sobra só a pergunta, com um ícone
 * de seta que leva pra /flashcards, e passar o mouse mostra a
 * pergunta+resposta completas como tooltip nativo. Assim que o cursor
 * entra na linha, tudo volta a aparecer normal (sintaxe crua) pra dar pra
 * editar — nada disso muda o documento, é só CSS/DOM via decorations.
 */
export const FlashcardHighlight = Extension.create({
  name: "flashcardHighlight",

  addProseMirrorPlugins() {
    const key = new PluginKey<{ hasFocus: boolean }>("flashcardHighlight");

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
          // decorations(state) só enxerga o doc/seleção, não se o editor
          // tem foco de verdade — sem isto, numa nota de UM parágrafo só,
          // o cursor "cai" dentro do parágrafo por padrão mesmo sem
          // ninguém ter clicado, e a resposta nunca escondia. Guarda o
          // foco real no state do próprio plugin, via uma transação
          // vazia (só meta) nos eventos de focus/blur do DOM do editor.
          const onFocus = () =>
            editorView.dispatch(editorView.state.tr.setMeta(key, { hasFocus: true }));
          const onBlur = () =>
            editorView.dispatch(editorView.state.tr.setMeta(key, { hasFocus: false }));
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
            let lastWasMultiQuestion = false;
            let lastMultiRange: { from: number; to: number } | null = null;

            state.doc.forEach((node: ProseMirrorNode, offset: number) => {
              if (node.type.name === "paragraph") {
                const raw = node.textContent;
                const text = raw.trim();
                lastWasMultiQuestion = false;
                lastMultiRange = null;

                if (!text) return;

                let kind: "simple" | "multi" | "cloze" | null = null;
                if (CLOZE_RE.test(text)) kind = "cloze";
                else if (text.endsWith("==") && text.length > 2) kind = "multi";
                else if (text.includes(">>")) kind = "simple";

                if (!kind) return;

                const nodeFrom = offset;
                const nodeTo = offset + node.nodeSize;
                // Editor com foco DE VERDADE + cursor/seleção tocando esta linha = modo
                // edição, mostra tudo cru.
                const isFocused = hasFocus && selFrom < nodeTo && selTo > nodeFrom;
                const paraStart = offset + 1; // primeira posição de texto dentro do parágrafo

                decorations.push(
                  Decoration.node(nodeFrom, nodeTo, {
                    class: `flashcard-line flashcard-${kind}${isFocused ? " flashcard-editing" : ""}`,
                    title: previewFor(kind, text),
                  })
                );

                if (!isFocused) {
                  if (kind === "simple") {
                    const idx = raw.indexOf(">>");
                    if (idx !== -1) {
                      decorations.push(
                        Decoration.inline(paraStart + idx, paraStart + raw.length, {
                          class: "flashcard-hidden",
                        })
                      );
                    }
                  } else if (kind === "multi") {
                    const idx = raw.lastIndexOf("==");
                    if (idx !== -1) {
                      decorations.push(
                        Decoration.inline(paraStart + idx, paraStart + raw.length, {
                          class: "flashcard-hidden",
                        })
                      );
                    }
                  } else if (kind === "cloze") {
                    // Esconde só o miolo "resposta" de cada {{cN::resposta}}, mantendo
                    // o resto da frase visível — e desenha um "[...]" no lugar.
                    const clozeRe = /\{\{c\d+::(.+?)\}\}/g;
                    let match: RegExpExecArray | null;
                    while ((match = clozeRe.exec(raw))) {
                      const from = paraStart + match.index;
                      const to = from + match[0].length;
                      decorations.push(Decoration.inline(from, to, { class: "flashcard-hidden" }));
                      decorations.push(Decoration.widget(to, clozePlaceholderWidget, { side: 1 }));
                    }
                  }
                  // Ícone "ir pros flashcards" só quando não está editando — enquanto
                  // edita, o fim da linha precisa ficar livre pra digitar.
                  decorations.push(Decoration.widget(nodeTo - 1, studyButtonWidget, { side: 1 }));
                }

                if (kind === "multi") {
                  lastWasMultiQuestion = true;
                  lastMultiRange = { from: nodeFrom, to: nodeTo };
                }
              } else if (
                lastWasMultiQuestion &&
                (node.type.name === "bulletList" || node.type.name === "orderedList")
              ) {
                const nodeFrom = offset;
                const nodeTo = offset + node.nodeSize;
                const questionFocused =
                  hasFocus && lastMultiRange !== null && selFrom < lastMultiRange.to && selTo > lastMultiRange.from;
                const listFocused = hasFocus && selFrom < nodeTo && selTo > nodeFrom;
                decorations.push(
                  Decoration.node(nodeFrom, nodeTo, {
                    class: `flashcard-answers${questionFocused || listFocused ? "" : " flashcard-hidden-node"}`,
                  })
                );
                lastWasMultiQuestion = false;
                lastMultiRange = null;
              } else {
                lastWasMultiQuestion = false;
                lastMultiRange = null;
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
