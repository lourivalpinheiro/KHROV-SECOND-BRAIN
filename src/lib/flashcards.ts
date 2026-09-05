import type { TiptapDoc } from "@/lib/doc-utils";
import { matchConcept } from "@/lib/concepts";

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

// Wikilink é um nó átomo (attrs.noteId/label, sem .text nem .content) —
// sem tratar ele à parte, o label some do texto extraído (mesmo bug
// corrigido em concepts.ts).
function nodeText(node: Node | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (node.type === "wikiLink") return typeof node.attrs?.label === "string" ? (node.attrs.label as string) : "";
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

/** Cloze deletion: `Texto com {{c1::a resposta}} escondida.` — um card por número de cN. */
const CLOZE_RE = /\{\{c(\d+)::(.+?)\}\}/g;

function extractClozeCards(text: string, nextId: () => string): Flashcard[] {
  // matchAll herda o lastIndex ATUAL do regex (não reseta pra 0 sozinho,
  // ao contrário de test()/replace()) — como CLOZE_RE é module-level e
  // compartilhado, o .test() de presença lá em cima pode deixar lastIndex
  // no meio da string, fazendo matchAll perder o primeiro match. Reseta
  // explicitamente antes de usar.
  CLOZE_RE.lastIndex = 0;
  const matches = Array.from(text.matchAll(CLOZE_RE));
  if (matches.length === 0) return [];

  const numbers = Array.from(new Set(matches.map((m) => m[1])));
  return numbers.map((num) => {
    const question = text
      .replace(CLOZE_RE, (_match, n: string, content: string) => (n === num ? "[...]" : content))
      .trim();
    const answers = matches.filter((m) => m[1] === num).map((m) => m[2].trim());
    return { id: nextId(), key: keyFor(`cloze:c${num}:${text}`), question, answers };
  });
}

/**
 * Extrai flashcards do conteúdo de uma nota. Duas fontes:
 *
 * 1. Blocos "flashcard" criados pelo botão de flashcard do editor (forma
 *    recomendada — pergunta e resposta(s) ficam em campos próprios, sem
 *    caracteres de sintaxe visíveis no texto).
 * 2. Sintaxe em texto legado, pra notas antigas: `Pergunta >> Resposta`, ou
 *    um parágrafo terminando em `==` seguido de uma lista de respostas.
 * 3. Cloze deletion: `Texto com {{c1::a resposta}} escondida.` — esconde só
 *    o trecho marcado, mantém o resto do parágrafo como contexto. Vários
 *    `{{c1::...}}` no mesmo parágrafo viram respostas do mesmo card;
 *    números diferentes (`c1`, `c2`...) viram cards separados.
 * 4. Conceitos: `:Termo::Definição` (ver concepts.ts) — vira "O que é
 *    Termo?" / Definição, além de entrar no glossário em /conceitos.
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

        const concept = matchConcept(text);
        if (concept) {
          if (concept.definition) {
            cards.push({
              id: nextId(),
              key: keyFor(`concept:${concept.term}`),
              question: `O que é ${concept.term}?`,
              answers: [concept.definition],
            });
          }
          continue;
        }

        CLOZE_RE.lastIndex = 0;
        if (CLOZE_RE.test(text)) {
          cards.push(...extractClozeCards(text, nextId));
          continue;
        }

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
