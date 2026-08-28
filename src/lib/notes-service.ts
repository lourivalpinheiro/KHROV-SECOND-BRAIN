import { prisma } from "@/lib/prisma";
import { extractLinkedNoteIds, extractPlainText, type TiptapDoc } from "@/lib/doc-utils";
import type { Prisma } from "@prisma/client";

/** Sincroniza a tabela NoteLink com os wikilinks presentes no conteúdo atual da nota. */
export async function syncNoteLinks(noteId: string, doc: TiptapDoc) {
  const linkedIds = extractLinkedNoteIds(doc).filter((id) => id !== noteId);

  // Só considera links para notas que de fato existem (e pertencem ao mesmo dono,
  // garantido implicitamente pois o autocomplete só sugere notas do próprio usuário).
  const existing = linkedIds.length
    ? await prisma.note.findMany({ where: { id: { in: linkedIds } }, select: { id: true } })
    : [];
  const validIds = new Set(existing.map((n) => n.id));

  await prisma.$transaction([
    prisma.noteLink.deleteMany({ where: { sourceNoteId: noteId } }),
    ...(validIds.size
      ? [
          prisma.noteLink.createMany({
            data: Array.from(validIds).map((targetNoteId) => ({
              sourceNoteId: noteId,
              targetNoteId,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

/** Cria/associa tags por nome (case-insensitive) e remove as que não estão mais na lista. */
export async function syncNoteTags(userId: string, noteId: string, tagNames: string[]) {
  const cleanNames = Array.from(
    new Set(tagNames.map((t) => t.trim()).filter(Boolean))
  );

  const tags = await Promise.all(
    cleanNames.map((name) =>
      prisma.tag.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { userId, name },
      })
    )
  );

  await prisma.$transaction([
    prisma.noteTag.deleteMany({ where: { noteId } }),
    ...(tags.length
      ? [
          prisma.noteTag.createMany({
            data: tags.map((tag) => ({ noteId, tagId: tag.id })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

export function computePlainText(content: Prisma.JsonValue): string {
  return extractPlainText(content as TiptapDoc);
}
