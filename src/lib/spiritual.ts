/**
 * Regras do módulo Espiritual — streaks e rótulos. Auto-contido (não
 * importa de health.ts) igual aos outros módulos: cada um tem sua própria
 * cópia dos utilitários de data/streak em vez de compartilhar entre si.
 */

/** Domingo=0 .. Sábado=6, mesma convenção de Date.getDay() usada em toda a Saúde/Espiritual. */
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

/** YYYY-MM-DD local (não UTC). */
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

export type SpiritualDayRecord = {
  date: string;
  prayerMorning: boolean;
  prayerNight: boolean;
  devotional: boolean;
  churchAttended: boolean;
};

function computeStreak(
  days: SpiritualDayRecord[],
  today: Date,
  isDone: (d: SpiritualDayRecord) => boolean,
  countsForStreak: (date: Date) => boolean
): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const todayKey = toLocalDateKey(today);
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
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
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return streak;
}

/** Streak de oração: só conta um dia quando AS DUAS orações (ao acordar e antes de dormir) foram marcadas. */
export function computePrayerStreak(days: SpiritualDayRecord[], today: Date): number {
  return computeStreak(
    days,
    today,
    (d) => d.prayerMorning && d.prayerNight,
    () => true
  );
}

export function computeDevotionalStreak(days: SpiritualDayRecord[], today: Date): number {
  return computeStreak(
    days,
    today,
    (d) => d.devotional,
    () => true
  );
}

/** Streak de igreja: só os dias PLANEJADOS (churchPlanDays) contam — igual à academia na Saúde. */
export function computeChurchStreak(days: SpiritualDayRecord[], today: Date, churchPlanDays: number[]): number {
  const planSet = new Set(churchPlanDays);
  return computeStreak(
    days,
    today,
    (d) => d.churchAttended,
    (date) => planSet.has(date.getDay())
  );
}

export const SERMON_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  READY: "Pronto",
  PREACHED: "Pregado",
};

export const SERMON_STATUS_ORDER = ["DRAFT", "READY", "PREACHED"] as const;
