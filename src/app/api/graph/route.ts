import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/**
 * Dados para a visualização de grafo: todas as notas, as ligações
 * [[wikilink]] entre elas, e as tags de cada uma (o client sintetiza um nó
 * de tag por tag e uma ligação nota→tag — sem isso, tags viviam fora do
 * grafo, diferente do Obsidian). Fora do grafo: notas na lixeira, e notas
 * de Córtex — são rascunho de sessão, ainda não processado, e poluiriam o
 * grafo (que é sobre conexões entre conhecimento já elaborado).
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const noteFilter = { userId, deletedAt: null, type: { not: "CORTEX" as const } };

    const [notes, links] = await Promise.all([
      prisma.note.findMany({
        where: noteFilter,
        select: {
          id: true,
          title: true,
          isHub: true,
          tags: { select: { tag: { select: { id: true, name: true } } } },
        },
      }),
      prisma.noteLink.findMany({
        where: { source: noteFilter, target: noteFilter },
        select: { sourceNoteId: true, targetNoteId: true },
      }),
    ]);

    return NextResponse.json({
      nodes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        isHub: n.isHub,
        tags: n.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
      })),
      links: links.map((l) => ({ source: l.sourceNoteId, target: l.targetNoteId })),
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
