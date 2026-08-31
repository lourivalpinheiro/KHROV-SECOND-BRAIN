/**
 * Fórmulas gerais de bem-estar — regras de bolso amplamente usadas, NÃO é
 * orientação médica/nutricional personalizada. Sempre mostradas com essa
 * ressalva na UI.
 */

/** Regra geral: ~35ml de água por kg de peso corporal. */
export function dailyWaterGoalMl(weightKg: number): number {
  return Math.round(weightKg * 35);
}

export function mlToLiters(ml: number): number {
  return ml / 1000;
}

/** Sugestão inicial de garrafas de 1L/dia a partir do peso — só um ponto de partida, o usuário define o número real (ex: 4) no perfil. */
export function suggestWaterGoalBottles(weightKg: number): number {
  return Math.max(1, Math.round(dailyWaterGoalMl(weightKg) / 1000));
}

/**
 * Estimativa de calorias por treino, via MET (equivalente metabólico) —
 * MET 6.0 é uma intensidade "moderada" pra treino misto (força + cardio
 * leve). Fórmula padrão: kcal = MET × peso(kg) × horas.
 */
const WORKOUT_MET = 6.0;

export function estimateWorkoutCalories(weightKg: number, minutes: number): number {
  return Math.round(WORKOUT_MET * weightKg * (minutes / 60));
}

export const MAX_WORKOUT_MINUTES = 70;

/** Domingo=0 .. Sábado=6, mesma convenção do Date.getDay() — usada em toda a semana da Saúde. */
export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const WEEKDAY_LABELS_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/** YYYY-MM-DD local (não UTC) — pra "hoje" bater com o fuso de quem está usando o app. */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Domingo (dia 0) da semana de `d`, no fuso local. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

/** Os 7 dias (Dom..Sáb) da semana de `d`, como chaves YYYY-MM-DD locais. */
export function weekDateKeys(d: Date): string[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return toLocalDateKey(day);
  });
}

export type DayRecord = { date: string; waterBottles: number; gym: boolean };

/**
 * Streak de água: dias seguidos (terminando hoje ou ontem) batendo a meta
 * de garrafas. Um dia passado abaixo da meta quebra a sequência; hoje
 * ainda abaixo não conta contra (a pessoa ainda tem o dia pra completar).
 */
export function computeWaterStreak(days: DayRecord[], today: Date, goalBottles: number): number {
  return computeStreak(
    days,
    today,
    (d) => d.waterBottles >= goalBottles,
    () => true
  );
}

/**
 * Streak de academia: só considera os dias PLANEJADOS (gymPlanDays) — um
 * dia fora do plano nunca quebra a sequência, mesmo sem ir. Só um dia
 * planejado e passado, sem marcar, quebra.
 */
export function computeGymStreak(days: DayRecord[], today: Date, gymPlanDays: number[]): number {
  const planSet = new Set(gymPlanDays);
  return computeStreak(
    days,
    today,
    (d) => d.gym,
    (date) => planSet.has(date.getDay())
  );
}

function computeStreak(
  days: DayRecord[],
  today: Date,
  isDone: (d: DayRecord) => boolean,
  countsForStreak: (date: Date) => boolean
): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const todayKey = toLocalDateKey(today);
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Trava de segurança: se countsForStreak nunca for true (ex: gymPlanDays
  // vazio), sem isto o loop nunca teria como parar sozinho.
  let guard = 3650;

  while (guard-- > 0) {
    const key = toLocalDateKey(cursor);
    if (!countsForStreak(cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const record = byDate.get(key);
    const done = record ? isDone(record) : false;
    if (done) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (key === todayKey) {
      // Hoje ainda não marcado — não quebra, só não conta ainda.
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return streak;
}
