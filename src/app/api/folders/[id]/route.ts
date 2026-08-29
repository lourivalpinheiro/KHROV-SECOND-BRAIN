import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { assertCanHaveChildren, getFolderAndDescendantIds } from "@/lib/folders-service";

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
    if (body.parentId === null || typeof body.parentId === "string") {
      // As 4 pastas-raiz do PARA ficam fixas na raiz — não podem virar
      // subpasta de outra coisa.
      if (folder.paraCategory) {
        return jsonError("Essa é uma pasta-raiz do PARA e não pode ser movida.", 400);
      }
      // Não pode mover a pasta pra dentro dela mesma nem de uma subpasta
      // dela — isso criaria um ciclo e quebraria qualquer árvore/recursão.
      if (body.parentId) {
        const invalidTargets = await getFolderAndDescendantIds(id);
        if (invalidTargets.includes(body.parentId)) {
          return jsonError("Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta dela.", 400);
        }
        const target = await prisma.folder.findUnique({ where: { id: body.parentId } });
        if (!target || target.userId !== userId) return jsonError("Pasta de destino não encontrada.", 404);
        try {
          await assertCanHaveChildren(body.parentId);
        } catch (err) {
          return jsonError(err instanceof Error ? err.message : "Não é possível mover a pasta pra lá.");
        }
      }
      data.parentId = body.parentId;
    }

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
    if (folder.paraCategory) {
      return jsonError("Essa é uma pasta-raiz do PARA e não pode ser excluída.", 400);
    }

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
