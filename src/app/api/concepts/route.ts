import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { extractConcepts } from "@/lib/concepts";
import type { TiptapDoc } from "@/lib/doc-utils";

/** Glossário: todos os conceitos (":Termo::Definição") de todas as notas do usuário, com as tags da nota de origem — agrupamento fica por conta de quem consome. */
export async function GET() {
  try {
    const userId = await requireUserId();

    const notes = await prisma.note.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    });

    const entries = notes.flatMap((note) => {
      const tags = note.tags.map((t) => t.tag.name);
      return extractConcepts(note.content as TiptapDoc).map((c) => ({
        id: `${note.id}:${c.id}`,
        term: c.term,
        definition: c.definition,
        noteId: note.id,
        noteTitle: note.title || "Nota sem título",
        tags,
      }));
    });

    entries.sort((a, b) => a.term.localeCompare(b.term, "pt-BR", { sensitivity: "base" }));

    return NextResponse.json(entries);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
