import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const variable = await prisma.financeBudgetVariable.findUnique({ where: { id } });
    if (!variable || variable.userId !== userId) return jsonError("Variável não encontrada.", 404);

    const body = await req.json().catch(() => ({}));
    const data: { name?: string; amount?: number } = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount)) return jsonError("Valor inválido.");
      data.amount = amount;
    }

    const updated = await prisma.financeBudgetVariable.update({ where: { id }, data });
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
    const variable = await prisma.financeBudgetVariable.findUnique({ where: { id } });
    if (!variable || variable.userId !== userId) return jsonError("Variável não encontrada.", 404);

    await prisma.financeBudgetVariable.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
