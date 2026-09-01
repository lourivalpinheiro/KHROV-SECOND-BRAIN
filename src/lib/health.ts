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

/** "Agosto de 2026" — usado pra agrupar as folhas do caderno de treino por mês. */
export function monthYearLabel(d: Date): string {
  const s = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

export type DayRecord = { date: string; waterBottles: number; gym: boolean; supplement?: boolean };

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

/**
 * Streak de suplementação: dias seguidos marcados, mesma lógica da água
 * (todo dia conta, sem "dias planejados" — é um hábito diário, não um
 * plano de treino).
 */
export function computeSupplementStreak(days: DayRecord[], today: Date): number {
  return computeStreak(
    days,
    today,
    (d) => d.supplement === true,
    () => true
  );
}

export type WeightPoint = { recordedAt: string; weightKg: number };

export type WeightTrend = {
  slopePerDay: number;
  slopePerWeek: number;
  intercept: number;
  firstDate: Date;
  residualStdDev: number;
  n: number;
};

/**
 * Regressão linear simples (mínimos quadrados) de peso × tempo, sobre os
 * snapshots do histórico — não é bem "machine learning" de verdade, é a
 * ferramenta certa pro volume de dado que um checkpoint mensal gera.
 * Precisa de pelo menos 2 registros em datas diferentes.
 */
export function computeWeightTrend(points: WeightPoint[]): WeightTrend | null {
  const sorted = points
    .map((p) => ({ x: new Date(p.recordedAt).getTime(), y: p.weightKg }))
    .sort((a, b) => a.x - b.x);
  const distinctX = new Set(sorted.map((p) => p.x));
  if (distinctX.size < 2) return null;

  const firstMs = sorted[0].x;
  const xs = sorted.map((p) => (p.x - firstMs) / 86400000); // dias desde o primeiro registro
  const ys = sorted.map((p) => p.y);
  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
  }
  const residualStdDev = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

  return { slopePerDay: slope, slopePerWeek: slope * 7, intercept, firstDate: new Date(firstMs), residualStdDev, n };
}

/**
 * Projeta o peso numa data futura a partir da tendência — regra de bolso
 * estatística ("se o ritmo dos últimos registros continuar assim"), não
 * uma previsão médica. A faixa cresce quanto mais longe da última
 * observação, pra deixar claro que é uma extrapolação, não uma certeza.
 */
export function predictWeight(trend: WeightTrend, targetDate: Date): { estimate: number; low: number; high: number; daysAhead: number } {
  const daysAhead = (targetDate.getTime() - trend.firstDate.getTime()) / 86400000;
  const estimate = trend.intercept + trend.slopePerDay * daysAhead;
  const base = Math.max(trend.residualStdDev, 0.3);
  const band = base * 1.96 * Math.sqrt(1 + Math.max(daysAhead, 0) / 90);
  return { estimate, low: estimate - band, high: estimate + band, daysAhead };
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

/**
 * Meta de peso: `baseline` é o peso registrado no momento em que a meta
 * foi definida (ou mudou) — define a direção (emagrecer ou ganhar peso).
 * Se a meta é igual ao baseline, não há o que bater.
 */
export function isWeightGoalReached(currentWeightKg: number, targetWeightKg: number, baselineWeightKg: number): boolean {
  if (targetWeightKg === baselineWeightKg) return true;
  return targetWeightKg < baselineWeightKg ? currentWeightKg <= targetWeightKg : currentWeightKg >= targetWeightKg;
}

/** 0..100 — quanto do caminho entre o peso de partida e a meta já foi andado (trava nas pontas, então nunca passa de 100 nem fica negativo mesmo se ultrapassar a meta). */
export function weightGoalProgressPercent(currentWeightKg: number, targetWeightKg: number, baselineWeightKg: number): number {
  if (targetWeightKg === baselineWeightKg) return 100;
  const pct = ((currentWeightKg - baselineWeightKg) / (targetWeightKg - baselineWeightKg)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** "23:00" → 1380 (minutos desde meia-noite). */
export function parseTimeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** 1380 → "23:00". */
export function minutesToTimeLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Pra desenhar num eixo contínuo: horários de madrugada (00:00–11:59)
 * "continuam" depois da noite anterior em vez de voltar pro início da
 * escala — 23:00 vira 1380, 00:30 vira 1470 (24h + 30min), assim dormir
 * um pouco depois da meia-noite aparece IMEDIATAMENTE depois de 23h no
 * gráfico, não lá no início do eixo.
 */
export function sleepChartValue(bedtimeMinutes: number): number {
  return bedtimeMinutes < 720 ? bedtimeMinutes + 1440 : bedtimeMinutes;
}
