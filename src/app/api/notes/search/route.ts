import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/** Usado pelo autocomplete de wikilink ([[ ) e pela busca global. */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const excludeId = searchParams.get("excludeId");

    const notes = await prisma.note.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    return NextResponse.json(notes);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
