import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

const STATUSES = ["DRAFT", "READY", "PREACHED"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const sermon = await prisma.sermon.findUnique({
      where: { id },
      include: { series: { select: { id: true, title: true } } },
    });
    if (!sermon || sermon.userId !== userId) return jsonError("Sermão não encontrado.", 404);
    return NextResponse.json({ ...sermon, date: sermon.date ? sermon.date.toISOString().slice(0, 10) : null });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const existing = await prisma.sermon.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Sermão não encontrado.", 404);

    const body = await req.json().catch(() => ({}));
    // Unchecked (não SermonUpdateInput) porque mexemos direto no escalar
    // seriesId em vez do relation "series: { connect/disconnect }".
    const data: Prisma.SermonUncheckedUpdateInput = {};

    if (typeof body.title === "string") {
      if (!body.title.trim()) return jsonError("O título não pode ficar vazio.");
      data.title = body.title.trim();
    }
    if (body.passage === null || body.passage === "") data.passage = null;
    else if (typeof body.passage === "string") data.passage = body.passage.trim();

    if (typeof body.status === "string") {
      if (!STATUSES.includes(body.status)) return jsonError("Status inválido.");
      data.status = body.status;
    }

    if (body.date === null || body.date === "") data.date = null;
    else if (typeof body.date === "string") {
      if (!DATE_RE.test(body.date)) return jsonError("Data inválida.");
      data.date = new Date(`${body.date}T00:00:00.000Z`);
    }

    if (body.content !== undefined) data.content = body.content;

    if (body.seriesId === null || body.seriesId === "") {
      data.seriesId = null;
    } else if (typeof body.seriesId === "string") {
      const series = await prisma.sermonSeries.findUnique({ where: { id: body.seriesId } });
      if (!series || series.userId !== userId) return jsonError("Série não encontrada.", 404);
      data.seriesId = series.id;
      if (body.order === undefined) {
        const last = await prisma.sermon.findFirst({ where: { seriesId: series.id }, orderBy: { order: "desc" } });
        data.order = (last?.order ?? -1) + 1;
      }
    }
    if (Number.isInteger(body.order)) data.order = body.order;

    const sermon = await prisma.sermon.update({ where: { id }, data });
    return NextResponse.json({ ...sermon, date: sermon.date ? sermon.date.toISOString().slice(0, 10) : null });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const existing = await prisma.sermon.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Sermão não encontrado.", 404);
    await prisma.sermon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
