import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { dailyAllowance, dateFromKey, projectHorizon, toLocalDateKey, type FinanceEntryLite } from "@/lib/finance";

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
      startingBalance: profile.startingBalance,
      startingBalanceDate: startKey,
      rangeStart: monthStart,
      rangeEnd: monthEnd,
    });

    const todayRow = monthDays.find((d) => d.date === todayKey);
    const currentBalance = todayRow?.balance ?? profile.startingBalance;
    const spentToday = todayRow?.dailySpend ?? 0;

    const totalIncome = monthDays.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = monthDays.reduce((sum, d) => sum + d.expense + d.dailySpend + d.creditCard, 0);

    return NextResponse.json({
      profile,
      currentBalance,
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
