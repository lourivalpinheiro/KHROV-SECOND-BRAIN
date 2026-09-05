import type { TiptapDoc } from "@/lib/doc-utils";

/**
 * Conceito: sintaxe `:Termo::Definição` num parágrafo — `:` colado no
 * termo (sem espaço) marca o início, `::` (ou `:` seguido de espaço e mais
 * `:`, ex: "Termo: :Definição" ou "Termo: Definição") separa termo de
 * definição. Tolerante a espaço em volta do(s) ":" do meio de propósito —
 * é natural digitar "Termo: Definição" com espaço, e travar só na forma
 * exata "::" fazia a sintaxe silenciosamente "não funcionar" nesse caso
 * comum. Vira entrada no glossário (/conceitos) e, junto, um flashcard "O
 * que é Termo?" (ver flashcards.ts) — sem exigir nada extra pra entrar na
 * revisão espaçada.
 */
export const CONCEPT_RE = /^:(\S.*?)(?:\s*:)+\s*([\s\S]*)$/;

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
