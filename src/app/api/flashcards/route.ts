import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { extractFlashcards } from "@/lib/flashcards";
import type { TiptapDoc } from "@/lib/doc-utils";

export async function GET() {
  try {
    const userId = await requireUserId();

    const notes = await prisma.note.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        content: true,
        folderId: true,
        folder: { select: { name: true } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });

    const cards = notes.flatMap((note) =>
      extractFlashcards(note.content as TiptapDoc).map((card) => ({
        ...card,
        id: `${note.id}:${card.id}`,
        noteId: note.id,
        noteTitle: note.title || "Nota sem título",
        folderId: note.folderId,
        folderName: note.folder?.name ?? null,
        tags: note.tags.map((t) => t.tag),
      }))
    );

    return NextResponse.json(cards);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
