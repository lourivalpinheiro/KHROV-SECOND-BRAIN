import type { TiptapDoc } from "@/lib/doc-utils";

/**
 * Conceito: sintaxe `:Termo::Definição` num parágrafo — `:` colado no
 * termo (sem espaço) marca o início, `::` separa termo de definição
 * (mesma convenção do cloze deletion, {{c1::resposta}}, pra reaproveitar
 * o que o usuário já sabe). Vira entrada no glossário (/conceitos) e,
 * junto, um flashcard "O que é Termo?" (ver flashcards.ts) — sem exigir
 * nada extra pra entrar na revisão espaçada.
 */
export const CONCEPT_RE = /^:(\S.*?)::([\s\S]*)$/;

export type Concept = {
  id: string;
  term: string;
  definition: string;
};

type Node = {
  type?: string;
  text?: string;
  content?: Node[];
};

function nodeText(node: Node | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(nodeText).join("");
}

/** Casa `:Termo::Definição` contra um texto de parágrafo já trimado. Devolve null se não bater. */
export function matchConcept(text: string): { term: string; definition: string } | null {
  const m = CONCEPT_RE.exec(text);
  if (!m) return null;
  const term = m[1].trim();
  const definition = m[2].trim();
  if (!term) return null;
  return { term, definition };
}

export function extractConcepts(doc: TiptapDoc | null | undefined): Concept[] {
  const concepts: Concept[] = [];
  let counter = 0;

  function walk(nodes: Node[]) {
    for (const node of nodes) {
      if (node.type === "paragraph") {
        const text = nodeText(node).trim();
        if (text) {
          const match = matchConcept(text);
          if (match) {
            concepts.push({ id: `concept-${counter++}`, term: match.term, definition: match.definition });
          }
        }
        continue;
      }
      if (node.content?.length) walk(node.content);
    }
  }

  walk(doc?.content ?? []);
  return concepts;
}
