import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import {
  computePrayerStreak,
  computeDevotionalStreak,
  computeChurchStreak,
  weekDateKeys,
  toLocalDateKey,
} from "@/lib/spiritual";

const HISTORY_DAYS = 120;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Tudo que o dashboard do Espiritual precisa num request só: perfil, semana de `?date=` (ou a atual) e streaks — mesmo formato do /api/health/summary. */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const profile = await prisma.spiritualProfile.findUnique({ where: { userId } });
    const churchPlanDays = profile?.churchPlanDays ?? [0, 2, 4];

    const { searchParams } = new URL(req.url);
    const anchorParam = searchParams.get("date");
    const anchorDate = anchorParam && DATE_RE.test(anchorParam) ? new Date(`${anchorParam}T00:00:00`) : new Date();

    const now = new Date();
    const since = new Date(Math.min(now.getTime(), anchorDate.getTime()));
    since.setDate(since.getDate() - HISTORY_DAYS);

    const rows = await prisma.spiritualDay.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true, prayerMorning: true, prayerNight: true, devotional: true, churchAttended: true },
    });
    const history = rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      prayerMorning: r.prayerMorning,
      prayerNight: r.prayerNight,
      devotional: r.devotional,
      churchAttended: r.churchAttended,
    }));

    const weekKeys = weekDateKeys(anchorDate);
    const byKey = new Map(history.map((h) => [h.date, h]));
    const weekDays = weekKeys.map(
      (key) => byKey.get(key) ?? { date: key, prayerMorning: false, prayerNight: false, devotional: false, churchAttended: false }
    );

    const prayerDaysThisWeek = weekDays.filter((d) => d.prayerMorning && d.prayerNight).length;
    const devotionalDaysThisWeek = weekDays.filter((d) => d.devotional).length;
    const churchDaysAttended = weekDays.filter((d) => d.churchAttended).length;
    const todayKey = toLocalDateKey(now);
    const churchDaysMissed = weekDays.filter(
      (d) => churchPlanDays.includes(new Date(`${d.date}T00:00:00`).getDay()) && !d.churchAttended && d.date < todayKey
    ).length;

    return NextResponse.json({
      profile: profile ?? { churchPlanDays },
      weekStart: weekKeys[0],
      weekEnd: weekKeys[6],
      isCurrentWeek: weekKeys[0] === weekDateKeys(now)[0],
      prayerDaysThisWeek,
      devotionalDaysThisWeek,
      churchDaysAttendedThisWeek: churchDaysAttended,
      churchDaysMissedThisWeek: churchDaysMissed,
      prayerStreak: computePrayerStreak(history, now),
      devotionalStreak: computeDevotionalStreak(history, now),
      churchStreak: computeChurchStreak(history, now, churchPlanDays),
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
