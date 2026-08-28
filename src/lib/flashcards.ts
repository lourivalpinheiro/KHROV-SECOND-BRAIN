import type { TiptapDoc } from "@/lib/doc-utils";

export type Flashcard = {
  id: string;
  /**
   * Identificador estável do card dentro da nota — usado pra guardar o
   * estado de repetição espaçada (FlashcardReview). Vem do attrs.id do
   * bloco de flashcard (persiste mesmo se a pergunta mudar); pra sintaxe
   * legada em texto, que não tem onde guardar um id, cai pra um fallback
   * baseado na própria pergunta (então editar a pergunta reinicia a revisão
   * desses casos — limitação aceitável, é sintaxe antiga).
   */
  key: string;
  question: string;
  /** Uma resposta = flashcard simples. Mais de uma = flashcard de múltiplas respostas. */
  answers: string[];
};

type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
};

function nodeText(node: Node | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(nodeText).join("");
}

function splitOnce(text: string, sep: string): [string, string] | null {
  const idx = text.indexOf(sep);
  if (idx === -1) return null;
  return [text.slice(0, idx), text.slice(idx + sep.length)];
}

function keyFor(question: string, blockId?: unknown): string {
  return typeof blockId === "string" && blockId ? `id:${blockId}` : `q:${question}`;
}

/**
 * Extrai flashcards do conteúdo de uma nota. Duas fontes:
 *
 * 1. Blocos "flashcard" criados pelo botão de flashcard do editor (forma
 *    recomendada — pergunta e resposta(s) ficam em campos próprios, sem
 *    caracteres de sintaxe visíveis no texto).
 * 2. Sintaxe em texto legado, pra notas antigas: `Pergunta >> Resposta`, ou
 *    um parágrafo terminando em `==` seguido de uma lista de respostas.
 */
export function extractFlashcards(doc: TiptapDoc | null | undefined): Flashcard[] {
  const cards: Flashcard[] = [];
  let counter = 0;
  const nextId = () => `card-${counter++}`;

  function walkList(nodes: Node[]) {
    let lastWasMultiQuestion: string | null = null;

    for (const node of nodes) {
      if (node.type === "flashcard") {
        const question = String(node.attrs?.question ?? "").trim();
        const answers = (Array.isArray(node.attrs?.answers) ? (node.attrs!.answers as unknown[]) : [])
          .map((a) => String(a).trim())
          .filter(Boolean);
        if (question && answers.length > 0) {
          cards.push({ id: nextId(), key: keyFor(question, node.attrs?.id), question, answers });
        }
        lastWasMultiQuestion = null;
        continue;
      }

      if (node.type === "paragraph") {
        const text = nodeText(node).trim();
        lastWasMultiQuestion = null;

        if (!text) continue;

        if (text.endsWith("==") && text.length > 2) {
          lastWasMultiQuestion = text.slice(0, -2).trim() || null;
        } else if (text.includes(">>")) {
          const pair = splitOnce(text, ">>");
          if (pair) {
            const question = pair[0].trim();
            cards.push({ id: nextId(), key: keyFor(question), question, answers: [pair[1].trim()] });
          }
        }
        continue;
      }

      if (
        lastWasMultiQuestion &&
        (node.type === "bulletList" || node.type === "orderedList")
      ) {
        const question = lastWasMultiQuestion;
        lastWasMultiQuestion = null;
        const answers: string[] = [];

        for (const item of node.content ?? []) {
          const itemText = nodeText(item).trim();
          if (!itemText) continue;

          const pair = splitOnce(itemText, ">>");
          if (pair) {
            answers.push(itemText);
            const itemQuestion = pair[0].trim();
            cards.push({ id: nextId(), key: keyFor(itemQuestion), question: itemQuestion, answers: [pair[1].trim()] });
          } else {
            answers.push(itemText);
          }
        }

        if (answers.length > 0) cards.push({ id: nextId(), key: keyFor(question), question, answers });
        continue;
      }

      lastWasMultiQuestion = null;

      // Continua procurando dentro de containers (blockquote, listas, etc.)
      if (node.content?.length) walkList(node.content);
    }
  }

  walkList(doc?.content ?? []);
  return cards;
}
