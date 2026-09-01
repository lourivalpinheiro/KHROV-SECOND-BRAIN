import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import {
  estimateWorkoutCalories,
  MAX_WORKOUT_MINUTES,
  computeWaterStreak,
  computeGymStreak,
  computeSupplementStreak,
  weekDateKeys,
  toLocalDateKey,
} from "@/lib/health";

const HISTORY_DAYS = 120;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tudo que o dashboard da Saúde precisa num request só: perfil, a semana
 * de `?date=` (ou a atual, sem o parâmetro) e streaks. Streaks e a
 * estimativa de calorias são sempre relativos a HOJE de verdade — só as
 * estatísticas "desta semana" mudam com o filtro, senão navegar pro
 * passado ia parecer que os streaks também "voltaram no tempo".
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const profile = await prisma.healthProfile.findUnique({ where: { userId } });

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    const { searchParams } = new URL(req.url);
    const anchorParam = searchParams.get("date");
    const anchorDate = anchorParam && DATE_RE.test(anchorParam) ? new Date(`${anchorParam}T00:00:00`) : new Date();

    const now = new Date();
    const since = new Date(Math.min(now.getTime(), anchorDate.getTime()));
    since.setDate(since.getDate() - HISTORY_DAYS);

    const rows = await prisma.healthDay.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true, waterBottles: true, gym: true, supplement: true },
    });
    const history = rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      waterBottles: r.waterBottles,
      gym: r.gym,
      supplement: r.supplement,
    }));

    const weekKeys = weekDateKeys(anchorDate);
    const byKey = new Map(history.map((h) => [h.date, h]));
    const weekDays = weekKeys.map((key) => byKey.get(key) ?? { date: key, waterBottles: 0, gym: false, supplement: false });

    const litersThisWeek = weekDays.reduce((sum, d) => sum + d.waterBottles, 0);
    const daysWithWaterThisWeek = weekDays.filter((d) => d.waterBottles >= profile.waterGoalBottles).length;

    const gymDaysAttended = weekDays.filter((d) => d.gym).length;
    // Só conta como "falta" um dia PLANEJADO que já passou e não foi marcado.
    const todayKey = toLocalDateKey(now);
    const gymDaysMissed = weekDays.filter(
      (d) => profile.gymPlanDays.includes(new Date(`${d.date}T00:00:00`).getDay()) && !d.gym && d.date < todayKey
    ).length;

    const supplementDaysThisWeek = weekDays.filter((d) => d.supplement).length;

    return NextResponse.json({
      profile,
      weekStart: weekKeys[0],
      weekEnd: weekKeys[6],
      isCurrentWeek: weekKeys[0] === weekDateKeys(now)[0],
      litersThisWeek,
      daysWithWaterThisWeek,
      gymDaysAttendedThisWeek: gymDaysAttended,
      gymDaysMissedThisWeek: gymDaysMissed,
      supplementDaysThisWeek,
      waterStreak: computeWaterStreak(history, now, profile.waterGoalBottles),
      gymStreak: computeGymStreak(history, now, profile.gymPlanDays),
      supplementStreak: computeSupplementStreak(history, now),
      estimatedCalories: estimateWorkoutCalories(profile.weightKg, MAX_WORKOUT_MINUTES),
      maxWorkoutMinutes: MAX_WORKOUT_MINUTES,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
