import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import {
  estimateWorkoutCalories,
  MAX_WORKOUT_MINUTES,
  computeWaterStreak,
  computeGymStreak,
  weekDateKeys,
  toLocalDateKey,
} from "@/lib/health";

const HISTORY_DAYS = 120;

/** Tudo que o dashboard da Saúde precisa num request só: perfil, semana atual e streaks. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.healthProfile.findUnique({ where: { userId } });

    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - HISTORY_DAYS);

    const rows = await prisma.healthDay.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true, waterBottles: true, gym: true },
    });
    const history = rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      waterBottles: r.waterBottles,
      gym: r.gym,
    }));

    const weekKeys = weekDateKeys(now);
    const byKey = new Map(history.map((h) => [h.date, h]));
    const weekDays = weekKeys.map((key) => byKey.get(key) ?? { date: key, waterBottles: 0, gym: false });

    const litersThisWeek = weekDays.reduce((sum, d) => sum + d.waterBottles, 0);
    const daysWithWaterThisWeek = weekDays.filter((d) => d.waterBottles >= profile.waterGoalBottles).length;

    const gymDaysAttended = weekDays.filter((d) => d.gym).length;
    // Só conta como "falta" um dia PLANEJADO que já passou e não foi marcado.
    const todayKey = toLocalDateKey(now);
    const gymDaysMissed = weekDays.filter(
      (d) => profile.gymPlanDays.includes(new Date(`${d.date}T00:00:00`).getDay()) && !d.gym && d.date < todayKey
    ).length;

    return NextResponse.json({
      profile,
      litersThisWeek,
      daysWithWaterThisWeek,
      gymDaysAttendedThisWeek: gymDaysAttended,
      gymDaysMissedThisWeek: gymDaysMissed,
      waterStreak: computeWaterStreak(history, now, profile.waterGoalBottles),
      gymStreak: computeGymStreak(history, now, profile.gymPlanDays),
      estimatedCalories: estimateWorkoutCalories(profile.weightKg, MAX_WORKOUT_MINUTES),
      maxWorkoutMinutes: MAX_WORKOUT_MINUTES,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
