import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { bibleBookByName } from "@/lib/bible";

/** Todos os capítulos já marcados como lidos — a grade completa de livros/capítulos é dado fixo no cliente (ver src/lib/bible.ts). */
export async function GET() {
  try {
    const userId = await requireUserId();
    const rows = await prisma.bibleReadingProgress.findMany({
      where: { userId },
      select: { book: true, chapter: true },
    });
    return NextResponse.json(rows);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/** Alterna um capítulo entre lido/não-lido — idempotente por (userId, book, chapter). */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const book = typeof body.book === "string" ? body.book : "";
    const chapter = Number(body.chapter);
    const bookDef = bibleBookByName(book);
    if (!bookDef || !Number.isInteger(chapter) || chapter < 1 || chapter > bookDef.chapters) {
      return jsonError("Livro ou capítulo inválido.");
    }

    const existing = await prisma.bibleReadingProgress.findUnique({
      where: { userId_book_chapter: { userId, book, chapter } },
    });

    if (existing) {
      await prisma.bibleReadingProgress.delete({ where: { id: existing.id } });
      return NextResponse.json({ read: false });
    }

    await prisma.bibleReadingProgress.create({ data: { userId, book, chapter } });
    return NextResponse.json({ read: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
