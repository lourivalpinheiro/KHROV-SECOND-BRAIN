import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

const CLOZE_RE = /\{\{c(\d+)::(.+?)\}\}/;
const CLOZE_RE_G = /\{\{c\d+::(.+?)\}\}/g;

/** Nome do evento disparado ao clicar numa linha reconhecida como flashcard — note-editor.tsx escuta e navega pra /flashcards. */
export const FLASHCARD_STUDY_EVENT = "khrov:study-flashcard";

type Kind = "simple" | "multi" | "cloze";

function detectKind(text: string): Kind | null {
  if (CLOZE_RE.test(text)) return "cloze";
  if (text.endsWith("==") && text.length > 2) return "multi";
  if (text.includes(">>")) return "simple";
  return null;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Pergunta + resposta(s) legíveis, pra usar como tooltip — não precisa ser exato, é só preview. */
function previewFor(kind: Kind, text: string): string {
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

/** Badge pequeno e discreto (só um indicador visual — quem responde ao clique é o handleClick do plugin, não este elemento). */
function badgeWidget() {
  const span = document.createElement("span");
  span.className = "flashcard-badge";
  span.contentEditable = "false";
  span.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>';
  return span;
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
 * linha, esconde a parte de resposta — sobra só a pergunta, como texto
 * normal com um badge discreto, tooltip nativo (pergunta+resposta
 * completas) e CLIQUE NO TEXTO leva pra /flashcards. Assim que o cursor
 * entra na linha (clique numa linha já focada, ou navegação por
 * teclado), tudo volta a aparecer normal (sintaxe crua) pra editar —
 * nada disso muda o documento, é só CSS/DOM via decorations.
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
          // Clique numa linha de flashcard AINDA recolhida (não focada) navega
          // pra /flashcards em vez de só posicionar o cursor — já que nesse
          // estado não tem nada editável visível mesmo. Clicar numa linha que
          // JÁ está focada (editando) continua posicionando o cursor normal.
          handleClick(view: EditorView, pos: number) {
            const hadFocus = key.getState(view.state)?.hasFocus ?? false;
            const { from: selFrom, to: selTo } = view.state.selection;

            const $pos = view.state.doc.resolve(pos);
            if ($pos.parent.type.name !== "paragraph") return false;

            const text = $pos.parent.textContent.trim();
            const kind = detectKind(text);
            if (!kind) return false;

            const nodeFrom = $pos.before($pos.depth);
            const nodeTo = nodeFrom + $pos.parent.nodeSize;
            const wasFocused = hadFocus && selFrom < nodeTo && selTo > nodeFrom;
            if (wasFocused) return false;

            window.dispatchEvent(new CustomEvent(FLASHCARD_STUDY_EVENT));
            return true;
          },
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

                const kind = detectKind(text);
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
                  // Badge discreto no fim da linha — só indicador visual, o
                  // clique é tratado pelo handleClick do plugin (acima).
                  decorations.push(Decoration.widget(nodeTo - 1, badgeWidget, { side: 1 }));
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
