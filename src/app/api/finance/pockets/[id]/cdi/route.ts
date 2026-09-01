import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { fetchCdiSeries } from "@/lib/cdi";
import { computeCdiEvolution, toLocalDateKey, type FinanceEntryLite } from "@/lib/finance";

/**
 * Evolução de um cofrinho indexado ao CDI (principal aportado × valor com
 * rendimento, dia a dia) — só existe quando o cofrinho tem %CDI E
 * vencimento definidos (ver /financeiro/cofrinhos). Vai só até o
 * vencimento ou hoje, o que vier primeiro.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const pocket = await prisma.financeSavingsPocket.findUnique({
      where: { id },
      include: {
        entries: {
          select: { date: true, type: true, amount: true, recurrence: true, recurrenceEndDate: true, savingsDirection: true, excludedDates: true },
        },
      },
    });
    if (!pocket || pocket.userId !== userId) return jsonError("Cofrinho não encontrado.", 404);

    if (!pocket.cdiPercentage || !pocket.maturityDate) {
      return NextResponse.json({ enabled: false, points: [] });
    }

    const startKey = pocket.startingBalanceDate ? toLocalDateKey(pocket.startingBalanceDate) : toLocalDateKey(pocket.createdAt);
    const todayKey = toLocalDateKey(new Date());
    const maturityKey = toLocalDateKey(pocket.maturityDate);
    const endKey = maturityKey < todayKey ? maturityKey : todayKey;

    if (endKey < startKey) {
      return NextResponse.json({ enabled: true, cdiPercentage: pocket.cdiPercentage, maturityDate: maturityKey, points: [] });
    }

    let cdiRates: Map<string, number>;
    try {
      cdiRates = await fetchCdiSeries(startKey, endKey);
    } catch {
      return jsonError("Não foi possível buscar a série do CDI no Banco Central agora — tenta de novo em instantes.", 502);
    }

    const entries: FinanceEntryLite[] = pocket.entries.map((e) => ({
      date: toLocalDateKey(e.date),
      type: e.type,
      amount: e.amount,
      recurrence: e.recurrence,
      recurrenceEndDate: e.recurrenceEndDate ? toLocalDateKey(e.recurrenceEndDate) : null,
      savingsDirection: e.savingsDirection,
      excludedDates: e.excludedDates,
    }));

    const points = computeCdiEvolution({
      entries,
      startingBalance: pocket.startingBalance,
      startingBalanceDate: startKey,
      cdiPercentage: pocket.cdiPercentage,
      cdiRatesByDate: cdiRates,
      rangeEnd: endKey,
    });

    return NextResponse.json({ enabled: true, cdiPercentage: pocket.cdiPercentage, maturityDate: maturityKey, points });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
