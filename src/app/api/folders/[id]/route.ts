import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { getFolderAndDescendantIds } from "@/lib/folders-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) return jsonError("Pasta não encontrada.", 404);

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.parentId === null || typeof body.parentId === "string") data.parentId = body.parentId;

    const updated = await prisma.folder.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) return jsonError("Pasta não encontrada.", 404);

    const deleteNotes = new URL(req.url).searchParams.get("deleteNotes") === "true";

    if (deleteNotes) {
      // Apaga a pasta, todas as subpastas e todas as notas dentro delas (em cascata).
      const folderIds = await getFolderAndDescendantIds(id);
      await prisma.note.deleteMany({ where: { userId, folderId: { in: folderIds } } });
    }

    // Sem deleteNotes: as notas ficam sem pasta (Note.folderId → SetNull) e as
    // subpastas são removidas em cascata pela FK Folder.parentId.
    await prisma.folder.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
