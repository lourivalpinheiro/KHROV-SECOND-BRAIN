import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { dailyAllowance, dateFromKey, pocketBalance, projectHorizon, toLocalDateKey, type FinanceEntryLite } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
function lastDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/**
 * Tudo que o dashboard da Financeiro precisa num request só: saldo de
 * caixa atual (sempre real, relativo a HOJE — nunca ao período filtrado),
 * investido, patrimônio total, totais do período `?from=&to=` (entradas,
 * saídas, saldo final projetado) e a previsão de gasto de hoje. Dias
 * futuros dentro do período assumem a previsão diária como gasto (zera a
 * cada dia — ver assumedDailyAllowance em projectHorizon).
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const profile = await prisma.financeProfile.findUnique({ where: { userId } });
    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const defaultFrom = firstDayOfMonthKey(now);
    const defaultTo = lastDayOfMonthKey(now);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const periodFrom = fromParam && DATE_RE.test(fromParam) ? fromParam : defaultFrom;
    const periodTo = toParam && DATE_RE.test(toParam) ? toParam : defaultTo;

    const startKey = toLocalDateKey(profile.startingBalanceDate);

    const variables = await prisma.financeBudgetVariable.findMany({ where: { userId } });
    const dailyCap = dailyAllowance(variables);

    // Investimento não é um número solto — é a soma dos cofrinhos kind=INVESTMENT.
    const investmentPockets = await prisma.financeSavingsPocket.findMany({
      where: { userId, kind: "INVESTMENT" },
      include: { entries: { select: { date: true, type: true, amount: true, recurrence: true, recurrenceEndDate: true, savingsDirection: true, excludedDates: true } } },
    });
    const investmentBalance = investmentPockets.reduce((sum, p) => {
      const entries: FinanceEntryLite[] = p.entries.map((e) => ({
        date: toLocalDateKey(e.date),
        type: e.type,
        amount: e.amount,
        recurrence: e.recurrence,
        recurrenceEndDate: e.recurrenceEndDate ? toLocalDateKey(e.recurrenceEndDate) : null,
        savingsDirection: e.savingsDirection,
        excludedDates: e.excludedDates,
      }));
      const movement = pocketBalance(entries, dateFromKey("2000-01-01"), now);
      return sum + p.startingBalance + movement;
    }, 0);

    const queryEnd = periodTo > todayKey ? periodTo : todayKey;
    const queryStartBound = startKey < periodFrom ? startKey : periodFrom;

    const rows = await prisma.financeEntry.findMany({
      where: {
        userId,
        date: { lte: dateFromKey(queryEnd) },
        OR: [{ recurrenceEndDate: null }, { recurrenceEndDate: { gte: dateFromKey(queryStartBound) } }],
      },
      select: { date: true, type: true, amount: true, recurrence: true, recurrenceEndDate: true, savingsDirection: true, excludedDates: true },
    });
    const entries: FinanceEntryLite[] = rows.map((r) => ({
      date: toLocalDateKey(r.date),
      type: r.type,
      amount: r.amount,
      recurrence: r.recurrence,
      recurrenceEndDate: r.recurrenceEndDate ? toLocalDateKey(r.recurrenceEndDate) : null,
      savingsDirection: r.savingsDirection,
      excludedDates: r.excludedDates,
    }));

    // Saldo de caixa ATUAL — sempre real (hoje), sem previsão diária assumida.
    const todayProjection = projectHorizon({
      entries,
      startingBalance: profile.startingCashBalance,
      startingBalanceDate: startKey,
      rangeStart: todayKey,
      rangeEnd: todayKey,
    });
    const currentCashBalance = todayProjection[0]?.balance ?? profile.startingCashBalance;
    const spentToday = todayProjection[0]?.dailySpend ?? 0;

    // Totais do período filtrado — dias futuros já assumem a previsão diária como gasto.
    const periodDays = projectHorizon({
      entries,
      startingBalance: profile.startingCashBalance,
      startingBalanceDate: startKey,
      rangeStart: periodFrom,
      rangeEnd: periodTo,
      assumedDailyAllowance: dailyCap,
      today: todayKey,
    });
    const totalIncome = periodDays.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = periodDays.reduce((sum, d) => sum + d.expense + d.dailySpend + d.creditCard, 0);
    const periodEndBalance = periodDays[periodDays.length - 1]?.balance ?? currentCashBalance;

    return NextResponse.json({
      profile,
      periodFrom,
      periodTo,
      currentCashBalance,
      investmentBalance,
      netWorth: currentCashBalance + investmentBalance,
      totalIncomeInPeriod: totalIncome,
      totalExpenseInPeriod: totalExpense,
      periodEndBalance,
      dailyAllowance: dailyCap,
      spentToday,
      remainingToday: dailyCap - spentToday,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
