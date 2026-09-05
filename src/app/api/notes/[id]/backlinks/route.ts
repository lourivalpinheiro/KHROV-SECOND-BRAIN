import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { extractLinkContexts, type TiptapDoc } from "@/lib/doc-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    // incoming: notas que linkam PRA esta (backlinks de verdade) — junto
    // do conteúdo, pra extrair o trecho exato de onde ela foi mencionada
    // (ver extractLinkContexts). outgoing: notas que esta nota
    // referencia/linka, sem precisar de contexto (o trecho já está na
    // tela, é a própria nota aberta).
    const [incomingLinks, outgoingLinks] = await Promise.all([
      prisma.noteLink.findMany({
        where: { targetNoteId: id, source: { userId } },
        include: { source: { select: { id: true, title: true, updatedAt: true, content: true } } },
        orderBy: { source: { updatedAt: "desc" } },
      }),
      prisma.noteLink.findMany({
        where: { sourceNoteId: id, target: { userId } },
        include: { target: { select: { id: true, title: true, updatedAt: true } } },
        orderBy: { target: { updatedAt: "desc" } },
      }),
    ]);

    return NextResponse.json({
      incoming: incomingLinks.map((l) => ({
        id: l.source.id,
        title: l.source.title,
        updatedAt: l.source.updatedAt,
        contexts: extractLinkContexts(l.source.content as TiptapDoc, id),
      })),
      outgoing: outgoingLinks.map((l) => l.target),
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
