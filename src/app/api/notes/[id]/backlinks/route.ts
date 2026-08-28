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

    const links = await prisma.noteLink.findMany({
      where: { targetNoteId: id, source: { userId } },
      include: { source: { select: { id: true, title: true, updatedAt: true } } },
      orderBy: { source: { updatedAt: "desc" } },
    });

    return NextResponse.json(links.map((l) => l.source));
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
