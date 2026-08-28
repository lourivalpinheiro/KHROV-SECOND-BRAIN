/**
 * Utilitários para trabalhar com o documento JSON do Tiptap no backend:
 * extrair texto puro (para busca) e ids de notas referenciadas via wikilink
 * (para manter a tabela NoteLink / backlinks em sincronia).
 */

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
};

export type TiptapDoc = TiptapNode;

function walk(node: TiptapNode | undefined, visit: (n: TiptapNode) => void) {
  if (!node) return;
  visit(node);
  node.content?.forEach((child) => walk(child, visit));
}

/** Extrai todo o texto do documento, separado por espaços/quebras de linha. */
export function extractPlainText(doc: TiptapDoc | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  walk(doc, (n) => {
    if (typeof n.text === "string") parts.push(n.text);
    if (n.type === "hardBreak" || n.type === "paragraph") parts.push("\n");
  });
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Extrai os ids de nota referenciados por nodes wikiLink no documento. */
export function extractLinkedNoteIds(doc: TiptapDoc | null | undefined): string[] {
  if (!doc) return [];
  const ids = new Set<string>();
  walk(doc, (n) => {
    if (n.type === "wikiLink" && typeof n.attrs?.noteId === "string") {
      ids.add(n.attrs.noteId as string);
    }
  });
  return Array.from(ids);
}

export const EMPTY_DOC: TiptapDoc = { type: "doc", content: [{ type: "paragraph" }] };
