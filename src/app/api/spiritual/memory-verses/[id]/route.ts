import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const existing = await prisma.memoryVerse.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Versículo não encontrado.", 404);

    const body = await req.json().catch(() => ({}));
    const data: { reference?: string; text?: string | null; status?: "LEARNING" | "MEMORIZED" } = {};

    if (typeof body.reference === "string") {
      if (!body.reference.trim()) return jsonError("A referência não pode ficar vazia.");
      data.reference = body.reference.trim();
    }
    if (body.text === null || body.text === "") data.text = null;
    else if (typeof body.text === "string") data.text = body.text.trim();
    if (body.status === "LEARNING" || body.status === "MEMORIZED") data.status = body.status;

    const updated = await prisma.memoryVerse.update({ where: { id }, data });
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
    const existing = await prisma.memoryVerse.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Versículo não encontrado.", 404);
    await prisma.memoryVerse.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
