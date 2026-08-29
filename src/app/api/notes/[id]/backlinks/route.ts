import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    // incoming: notas que linkam PRA esta (backlinks de verdade).
    // outgoing: notas que esta nota referencia/linka (wikilinks dentro dela,
    // incluindo as criadas na hora pelo autocomplete [[ ).
    const [incomingLinks, outgoingLinks] = await Promise.all([
      prisma.noteLink.findMany({
        where: { targetNoteId: id, source: { userId } },
        include: { source: { select: { id: true, title: true, updatedAt: true } } },
        orderBy: { source: { updatedAt: "desc" } },
      }),
      prisma.noteLink.findMany({
        where: { sourceNoteId: id, target: { userId } },
        include: { target: { select: { id: true, title: true, updatedAt: true } } },
        orderBy: { target: { updatedAt: "desc" } },
      }),
    ]);

    return NextResponse.json({
      incoming: incomingLinks.map((l) => l.source),
      outgoing: outgoingLinks.map((l) => l.target),
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
