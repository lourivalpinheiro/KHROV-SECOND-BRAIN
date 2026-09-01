import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const tag = await prisma.financeTag.findUnique({ where: { id } });
    if (!tag || tag.userId !== userId) return jsonError("Tag não encontrada.", 404);

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError("Nome da tag é obrigatório.");

    const existing = await prisma.financeTag.findUnique({ where: { userId_name: { userId, name } } });
    if (existing && existing.id !== id) return jsonError("Já existe uma tag com esse nome.");

    const updated = await prisma.financeTag.update({ where: { id }, data: { name } });
    return NextResponse.json(updated);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const tag = await prisma.financeTag.findUnique({ where: { id } });
    if (!tag || tag.userId !== userId) return jsonError("Tag não encontrada.", 404);

    await prisma.financeTag.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
