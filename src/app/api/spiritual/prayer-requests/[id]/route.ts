import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

/** Edita título/notas, ou marca respondido/reabre (status ACTIVE/ANSWERED) — nunca apaga o histórico, só marca. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const existing = await prisma.prayerRequest.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Pedido não encontrado.", 404);

    const body = await req.json().catch(() => ({}));
    const data: { title?: string; notes?: string | null; status?: "ACTIVE" | "ANSWERED"; answeredAt?: Date | null } = {};

    if (typeof body.title === "string") {
      if (!body.title.trim()) return jsonError("O pedido não pode ficar vazio.");
      data.title = body.title.trim();
    }
    if (body.notes === null || body.notes === "") data.notes = null;
    else if (typeof body.notes === "string") data.notes = body.notes.trim();

    if (body.status === "ANSWERED" && existing.status !== "ANSWERED") {
      data.status = "ANSWERED";
      data.answeredAt = new Date();
    } else if (body.status === "ACTIVE" && existing.status !== "ACTIVE") {
      data.status = "ACTIVE";
      data.answeredAt = null;
    }

    const updated = await prisma.prayerRequest.update({ where: { id }, data });
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
    const existing = await prisma.prayerRequest.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Pedido não encontrado.", 404);
    await prisma.prayerRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
