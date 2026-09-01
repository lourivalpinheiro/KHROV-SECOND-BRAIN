import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { pocketBalance, toLocalDateKey, type FinanceEntryLite } from "@/lib/finance";

const LOOKBACK_YEARS = 10;

/** Todos os cofrinhos do usuário, cada um já com o saldo atual calculado (depósitos − resgates, recorrência expandida até hoje). */
export async function GET() {
  try {
    const userId = await requireUserId();
    const pockets = await prisma.financeSavingsPocket.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { entries: { select: { date: true, type: true, amount: true, recurrence: true, recurrenceEndDate: true, savingsDirection: true } } },
    });

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setFullYear(rangeStart.getFullYear() - LOOKBACK_YEARS);
    const rangeStartKey = toLocalDateKey(rangeStart);
    const todayKey = toLocalDateKey(now);

    const result = pockets.map((p) => {
      const entries: FinanceEntryLite[] = p.entries.map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        type: e.type,
        amount: e.amount,
        recurrence: e.recurrence,
        recurrenceEndDate: e.recurrenceEndDate ? e.recurrenceEndDate.toISOString().slice(0, 10) : null,
        savingsDirection: e.savingsDirection,
      }));
      const movement = pocketBalance(entries, new Date(`${rangeStartKey}T00:00:00`), new Date(`${todayKey}T00:00:00`));
      return {
        id: p.id,
        name: p.name,
        kind: p.kind,
        startingBalance: p.startingBalance,
        startingBalanceDate: p.startingBalanceDate ? p.startingBalanceDate.toISOString().slice(0, 10) : null,
        targetAmount: p.targetAmount,
        targetDate: p.targetDate ? p.targetDate.toISOString().slice(0, 10) : null,
        monthlyContribution: p.monthlyContribution,
        createdAt: p.createdAt,
        balance: p.startingBalance + movement,
      };
    });

    return NextResponse.json(result);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError("Nome do cofrinho é obrigatório.");
    const kind = body.kind === "INVESTMENT" ? "INVESTMENT" : "SAVINGS";

    let startingBalance = 0;
    let startingBalanceDate: Date | null = null;
    if (body.startingBalance !== undefined && body.startingBalance !== null && body.startingBalance !== "") {
      const n = Number(body.startingBalance);
      if (!Number.isFinite(n)) return jsonError("Saldo inicial do cofrinho inválido.");
      startingBalance = n;
      startingBalanceDate = new Date(`${(body.startingBalanceDate as string) || toLocalDateKey(new Date())}T00:00:00.000Z`);
    }

    let targetAmount: number | null = null;
    let targetDate: Date | null = null;
    let monthlyContribution: number | null = null;
    if (body.targetAmount !== undefined && body.targetAmount !== null && body.targetAmount !== "") {
      const n = Number(body.targetAmount);
      if (!Number.isFinite(n) || n <= 0) return jsonError("Valor da meta inválido.");
      targetAmount = n;
    }
    if (body.targetDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) return jsonError("Prazo inválido.");
      targetDate = new Date(`${body.targetDate}T00:00:00.000Z`);
    }
    if (body.monthlyContribution !== undefined && body.monthlyContribution !== null && body.monthlyContribution !== "") {
      const n = Number(body.monthlyContribution);
      if (!Number.isFinite(n) || n < 0) return jsonError("Valor mensal inválido.");
      monthlyContribution = n;
    }

    const pocket = await prisma.financeSavingsPocket.create({
      data: { userId, name, kind, startingBalance, startingBalanceDate, targetAmount, targetDate, monthlyContribution },
    });
    return NextResponse.json(pocket, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
