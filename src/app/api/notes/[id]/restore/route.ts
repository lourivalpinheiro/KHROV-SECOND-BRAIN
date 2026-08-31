import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

/** Tira a nota da lixeira — volta a aparecer em todas as listas normais. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Nota não encontrada.", 404);
    if (!existing.deletedAt) return jsonError("Essa nota não está na lixeira.", 400);

    const note = await prisma.note.update({ where: { id }, data: { deletedAt: null } });

    return NextResponse.json(note);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
