import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/**
 * Um Engrama aleatório pra "resurgir" — revisitar algo já consolidado de
 * vez em quando, mesmo espírito da repetição espaçada dos flashcards, só
 * que pro conhecimento em si. Sorteia no banco (RANDOM(), tabela pequena o
 * bastante pra não pesar) em vez de trazer tudo pro Node só pra escolher
 * um índice.
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Note"
      WHERE "userId" = ${userId} AND "deletedAt" IS NULL AND "type" = 'ENGRAM'
      ORDER BY RANDOM()
      LIMIT 1
    `;
    const id = rows[0]?.id;
    if (!id) return NextResponse.json(null);

    const note = await prisma.note.findUnique({
      where: { id },
      select: { id: true, title: true, plainText: true, updatedAt: true },
    });
    return NextResponse.json(note);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
