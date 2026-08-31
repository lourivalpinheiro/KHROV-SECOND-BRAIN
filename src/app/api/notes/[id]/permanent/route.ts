import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

/**
 * Exclusão de verdade, sem volta. Só permite apagar o que já está na
 * lixeira — força passar pelo soft delete primeiro (DELETE /api/notes/[id]),
 * nunca um atalho direto de "excluir pra sempre" a partir da nota normal.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Nota não encontrada.", 404);
    if (!existing.deletedAt) return jsonError("Mande a nota pra lixeira antes de excluir de vez.", 400);

    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
