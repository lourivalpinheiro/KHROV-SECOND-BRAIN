import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { dateFromKey, projectHorizon, toLocalDateKey, type FinanceEntryLite } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 731; // trava de segurança, igual à do módulo Saúde

function firstDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Saldo projetado dia a dia entre `?from=&to=` — alimenta o "horizonte de saldo" (mapa de temperatura). */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const profile = await prisma.financeProfile.findUnique({ where: { userId } });
    if (!profile) {
      return NextResponse.json({ profile: null, days: [] });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const defaultFrom = firstDayOfMonthKey(now);
    const defaultToDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const defaultTo = toLocalDateKey(defaultToDate);

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const fromKey = fromParam && DATE_RE.test(fromParam) ? fromParam : defaultFrom;
    let toKey = toParam && DATE_RE.test(toParam) ? toParam : defaultTo;

    const fromDate = dateFromKey(fromKey);
    let toDate = dateFromKey(toKey);
    const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    if (spanDays > MAX_RANGE_DAYS) {
      toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + MAX_RANGE_DAYS - 1);
      toKey = toLocalDateKey(toDate);
    }

    const startKey = toLocalDateKey(profile.startingBalanceDate);
    const spanStartKey = startKey < fromKey ? startKey : fromKey;

    const rows = await prisma.financeEntry.findMany({
      where: {
        userId,
        date: { lte: dateFromKey(toKey) },
        OR: [{ recurrenceEndDate: null }, { recurrenceEndDate: { gte: dateFromKey(spanStartKey) } }],
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

    const days = projectHorizon({
      entries,
      startingBalance: profile.startingBalance,
      startingBalanceDate: startKey,
      rangeStart: fromKey,
      rangeEnd: toKey,
    });

    return NextResponse.json({ profile, days });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
