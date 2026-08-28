import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { extractPlainText, type TiptapDoc } from "@/lib/doc-utils";
import { syncNoteLinks, syncNoteTags } from "@/lib/notes-service";

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
        folder: true,
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
    if (body.folderId === null || typeof body.folderId === "string") data.folderId = body.folderId;

    let contentDoc: TiptapDoc | undefined;
    if (body.content !== undefined) {
      contentDoc = body.content as TiptapDoc;
      data.content = contentDoc;
      data.plainText = extractPlainText(contentDoc);
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
      include: { tags: { include: { tag: true } }, folder: true, attachments: true },
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
