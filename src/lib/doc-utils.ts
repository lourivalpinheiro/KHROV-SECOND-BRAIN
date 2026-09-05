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

/** Um trecho de texto do contexto de um link — `isLink` marca o pedaço que é o próprio wikilink (label), pra destacar na UI. */
export type LinkContextSegment = { text: string; isLink?: boolean };
export type LinkContext = { segments: LinkContextSegment[] };

const BLOCK_TYPES = new Set(["paragraph", "heading"]);

function flattenInlineSegments(node: TiptapNode): LinkContextSegment[] {
  const segments: LinkContextSegment[] = [];
  function inner(n: TiptapNode) {
    if (typeof n.text === "string") {
      segments.push({ text: n.text });
      return;
    }
    if (n.type === "wikiLink") {
      segments.push({ text: typeof n.attrs?.label === "string" ? (n.attrs.label as string) : "", isLink: true });
      return;
    }
    n.content?.forEach(inner);
  }
  inner(node);
  return segments;
}

function containsWikiLinkTo(node: TiptapNode, targetNoteId: string): boolean {
  let found = false;
  walk(node, (n) => {
    if (n.type === "wikiLink" && n.attrs?.noteId === targetNoteId) found = true;
  });
  return found;
}

/**
 * Pra cada bloco (parágrafo ou título) do documento que menciona
 * `targetNoteId` via wikilink, devolve o texto do bloco inteiro,
 * segmentado pra poder destacar o pedaço que é o link — é o "onde ela foi
 * mencionada" que aparece no painel de Conexões, em vez de só o título da
 * nota de origem.
 */
export function extractLinkContexts(doc: TiptapDoc | null | undefined, targetNoteId: string): LinkContext[] {
  if (!doc) return [];
  const contexts: LinkContext[] = [];

  function walkBlocks(node: TiptapNode) {
    if (node.type && BLOCK_TYPES.has(node.type)) {
      if (containsWikiLinkTo(node, targetNoteId)) {
        const segments = flattenInlineSegments(node).filter((s) => s.text);
        if (segments.length > 0) contexts.push({ segments });
      }
      return;
    }
    node.content?.forEach(walkBlocks);
  }

  walkBlocks(doc);
  return contexts;
}
