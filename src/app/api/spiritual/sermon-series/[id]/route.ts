import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const existing = await prisma.sermonSeries.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Série não encontrada.", 404);

    const body = await req.json().catch(() => ({}));
    const data: { title?: string; description?: string | null } = {};
    if (typeof body.title === "string") {
      if (!body.title.trim()) return jsonError("O título não pode ficar vazio.");
      data.title = body.title.trim();
    }
    if (body.description === null || body.description === "") data.description = null;
    else if (typeof body.description === "string") data.description = body.description.trim();

    const series = await prisma.sermonSeries.update({ where: { id }, data });
    return NextResponse.json(series);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/** Exclui a série — os sermões dela continuam existindo, só deixam de apontar pra ela (onDelete: SetNull no schema). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const existing = await prisma.sermonSeries.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Série não encontrada.", 404);
    await prisma.sermonSeries.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
