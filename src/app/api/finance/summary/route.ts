import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { dailyAllowance, dateFromKey, pocketBalance, projectHorizon, toLocalDateKey, type FinanceEntryLite } from "@/lib/finance";

function firstDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
function lastDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Tudo que o dashboard da Financeiro precisa num request só: saldo atual, totais do mês e a previsão de gasto de hoje. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.financeProfile.findUnique({ where: { userId } });
    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const monthStart = firstDayOfMonthKey(now);
    const monthEnd = lastDayOfMonthKey(now);
    const startKey = toLocalDateKey(profile.startingBalanceDate);

    const variables = await prisma.financeBudgetVariable.findMany({ where: { userId } });
    const dailyCap = dailyAllowance(variables);

    // Investimento não é um número solto — é a soma dos cofrinhos kind=INVESTMENT.
    const investmentPockets = await prisma.financeSavingsPocket.findMany({
      where: { userId, kind: "INVESTMENT" },
      include: { entries: { select: { date: true, type: true, amount: true, recurrence: true, recurrenceEndDate: true, savingsDirection: true } } },
    });
    const investmentBalance = investmentPockets.reduce((sum, p) => {
      const entries: FinanceEntryLite[] = p.entries.map((e) => ({
        date: toLocalDateKey(e.date),
        type: e.type,
        amount: e.amount,
        recurrence: e.recurrence,
        recurrenceEndDate: e.recurrenceEndDate ? toLocalDateKey(e.recurrenceEndDate) : null,
        savingsDirection: e.savingsDirection,
      }));
      const movement = pocketBalance(entries, dateFromKey("2000-01-01"), now);
      return sum + p.startingBalance + movement;
    }, 0);

    const rows = await prisma.financeEntry.findMany({
      where: {
        userId,
        date: { lte: dateFromKey(monthEnd) },
        OR: [{ recurrenceEndDate: null }, { recurrenceEndDate: { gte: dateFromKey(startKey) } }],
      },
      select: { date: true, type: true, amount: true, recurrence: true, recurrenceEndDate: true, savingsDirection: true },
    });
    const entries: FinanceEntryLite[] = rows.map((r) => ({
      date: toLocalDateKey(r.date),
      type: r.type,
      amount: r.amount,
      recurrence: r.recurrence,
      recurrenceEndDate: r.recurrenceEndDate ? toLocalDateKey(r.recurrenceEndDate) : null,
      savingsDirection: r.savingsDirection,
    }));

    const monthDays = projectHorizon({
      entries,
      startingBalance: profile.startingCashBalance,
      startingBalanceDate: startKey,
      rangeStart: monthStart,
      rangeEnd: monthEnd,
    });

    const todayRow = monthDays.find((d) => d.date === todayKey);
    const currentCashBalance = todayRow?.balance ?? profile.startingCashBalance;
    const spentToday = todayRow?.dailySpend ?? 0;

    const totalIncome = monthDays.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = monthDays.reduce((sum, d) => sum + d.expense + d.dailySpend + d.creditCard, 0);

    return NextResponse.json({
      profile,
      currentCashBalance,
      investmentBalance,
      netWorth: currentCashBalance + investmentBalance,
      totalIncomeThisMonth: totalIncome,
      totalExpenseThisMonth: totalExpense,
      dailyAllowance: dailyCap,
      spentToday,
      remainingToday: dailyCap - spentToday,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
