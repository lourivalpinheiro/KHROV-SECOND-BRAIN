import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { extractPlainText, extractLinkedNoteIds, type TiptapDoc } from "@/lib/doc-utils";
import { syncNoteLinks, syncNoteTags } from "@/lib/notes-service";
import { extractFlashcards } from "@/lib/flashcards";
import { isNoteType, checkPromotion } from "@/lib/note-types";

async function getOwnedNote(id: string, userId: string) {
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note || note.userId !== userId) return null;
  return note;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        attachments: true,
      },
    });

    if (!note || note.userId !== userId) return jsonError("Nota não encontrada.", 404);

    return NextResponse.json(note);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await getOwnedNote(id, userId);
    if (!existing) return jsonError("Nota não encontrada.", 404);

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof body.title === "string") data.title = body.title.trim() || "Nota sem título";
    if (typeof body.synthesisText === "string") data.synthesisText = body.synthesisText;

    let contentDoc: TiptapDoc | undefined;
    if (body.content !== undefined) {
      contentDoc = body.content as TiptapDoc;
      data.content = contentDoc;
      data.plainText = extractPlainText(contentDoc);
    }

    if (isNoteType(body.type)) {
      // A trava de fricção é validada aqui, no servidor — nunca só no
      // client — senão dava pra promover sem cumprir o requisito só
      // chamando a API direto.
      const synthesisText = typeof body.synthesisText === "string" ? body.synthesisText : existing.synthesisText;
      const doc = (contentDoc ?? existing.content) as TiptapDoc;
      const plainText = contentDoc ? (data.plainText as string) : existing.plainText;
      // Ids de nota linkados direto no conteúdo ATUAL da nota (não na tabela
      // NoteLink) — a tabela só fica em dia depois que o conteúdo é salvo
      // (syncNoteLinks), então checar por ela aqui podia ficar
      // dessincronizada do que a nota realmente tem agora.
      const linkedIds = extractLinkedNoteIds(doc).filter((linkedId) => linkedId !== id);
      // Filtro anti-lixo: só conta como referência de verdade se a nota
      // linkada já tiver conteúdo escrito, ou já estiver madura (Sinapse/
      // Engrama) — senão dava pra criar um "[[a]]" vazio só pra destravar.
      let hasValidOutgoingLink = false;
      if (linkedIds.length > 0) {
        const linkedNotes = await prisma.note.findMany({
          where: { id: { in: linkedIds }, userId },
          select: { plainText: true, type: true },
        });
        hasValidOutgoingLink = linkedNotes.some(
          (n) => n.plainText.trim().length > 0 || n.type === "SYNAPSE" || n.type === "ENGRAM"
        );
      }
      const flashcardCount = extractFlashcards(doc).length;
      const check = checkPromotion(existing.type, body.type, {
        hasValidOutgoingLink,
        synthesisText,
        flashcardCount,
        plainText,
      });
      if (!check.ok) return jsonError(check.reason, 400);
      data.type = body.type;
    }

    const note = await prisma.note.update({ where: { id }, data });

    if (Array.isArray(body.tags)) {
      await syncNoteTags(userId, id, body.tags as string[]);
    }

    if (contentDoc) {
      await syncNoteLinks(id, contentDoc);
    }

    const full = await prisma.note.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, attachments: true },
    });

    return NextResponse.json(full ?? note);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await getOwnedNote(id, userId);
    if (!existing) return jsonError("Nota não encontrada.", 404);

    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
