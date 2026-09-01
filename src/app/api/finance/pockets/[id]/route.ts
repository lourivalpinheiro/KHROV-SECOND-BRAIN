import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { pocketBalance, toLocalDateKey, type FinanceEntryLite } from "@/lib/finance";

const LOOKBACK_YEARS = 10;

/** Um cofrinho com o saldo atual — a lista de lançamentos em si vem de /api/finance/entries?pocketId=. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const pocket = await prisma.financeSavingsPocket.findUnique({
      where: { id },
      include: { entries: { select: { date: true, type: true, amount: true, recurrence: true, recurrenceEndDate: true, savingsDirection: true } } },
    });
    if (!pocket || pocket.userId !== userId) return jsonError("Cofrinho não encontrado.", 404);

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setFullYear(rangeStart.getFullYear() - LOOKBACK_YEARS);
    const entries: FinanceEntryLite[] = pocket.entries.map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      amount: e.amount,
      recurrence: e.recurrence,
      recurrenceEndDate: e.recurrenceEndDate ? e.recurrenceEndDate.toISOString().slice(0, 10) : null,
      savingsDirection: e.savingsDirection,
    }));
    const balance = pocketBalance(entries, rangeStart, now);

    return NextResponse.json({
      id: pocket.id,
      name: pocket.name,
      targetAmount: pocket.targetAmount,
      targetDate: pocket.targetDate ? toLocalDateKey(pocket.targetDate) : null,
      monthlyContribution: pocket.monthlyContribution,
      createdAt: pocket.createdAt,
      balance,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const pocket = await prisma.financeSavingsPocket.findUnique({ where: { id } });
    if (!pocket || pocket.userId !== userId) return jsonError("Cofrinho não encontrado.", 404);

    const body = await req.json().catch(() => ({}));
    const data: {
      name?: string;
      targetAmount?: number | null;
      targetDate?: Date | null;
      monthlyContribution?: number | null;
    } = {};

    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();

    if (body.targetAmount === null || body.targetAmount === "") {
      data.targetAmount = null;
    } else if (body.targetAmount !== undefined) {
      const n = Number(body.targetAmount);
      if (!Number.isFinite(n) || n <= 0) return jsonError("Valor da meta inválido.");
      data.targetAmount = n;
    }

    if (body.targetDate === null || body.targetDate === "") {
      data.targetDate = null;
    } else if (body.targetDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) return jsonError("Prazo inválido.");
      data.targetDate = new Date(`${body.targetDate}T00:00:00.000Z`);
    }

    if (body.monthlyContribution === null || body.monthlyContribution === "") {
      data.monthlyContribution = null;
    } else if (body.monthlyContribution !== undefined) {
      const n = Number(body.monthlyContribution);
      if (!Number.isFinite(n) || n < 0) return jsonError("Valor mensal inválido.");
      data.monthlyContribution = n;
    }

    const updated = await prisma.financeSavingsPocket.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/** Apaga o cofrinho — os lançamentos dele continuam existindo, só perdem o vínculo (onDelete: SetNull no schema). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const pocket = await prisma.financeSavingsPocket.findUnique({ where: { id } });
    if (!pocket || pocket.userId !== userId) return jsonError("Cofrinho não encontrado.", 404);

    await prisma.financeSavingsPocket.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
