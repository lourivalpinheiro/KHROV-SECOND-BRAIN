/**
 * Módulo Financeiro — lógica pura (sem Prisma/Next aqui, só cálculo), pra
 * ser fácil de testar e reusar tanto nas rotas de API quanto no cliente.
 */

export type EntryType = "INCOME" | "EXPENSE" | "SAVINGS" | "DAILY" | "CREDIT_CARD";
export type RecurrenceKind = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  INCOME: "Entrada",
  EXPENSE: "Saída",
  SAVINGS: "Economia",
  DAILY: "Diário",
  CREDIT_CARD: "Cartão de crédito",
};

export const RECURRENCE_LABELS: Record<RecurrenceKind, string> = {
  NONE: "Não repete",
  DAILY: "Diariamente",
  WEEKLY: "Semanalmente",
  MONTHLY: "Mensalmente",
  YEARLY: "Anualmente",
};

const ENTRY_TYPES: EntryType[] = ["INCOME", "EXPENSE", "SAVINGS", "DAILY", "CREDIT_CARD"];
const RECURRENCE_KINDS: RecurrenceKind[] = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

export function isEntryType(v: unknown): v is EntryType {
  return typeof v === "string" && (ENTRY_TYPES as string[]).includes(v);
}

export function isRecurrenceKind(v: unknown): v is RecurrenceKind {
  return typeof v === "string" && (RECURRENCE_KINDS as string[]).includes(v);
}

/** YYYY-MM-DD local (não UTC) — mesmo raciocínio do módulo Saúde: "hoje" precisa bater com o fuso de quem usa o app. */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

export function addDays(key: string, delta: number): string {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + delta);
  return toLocalDateKey(d);
}

/** Soma meses a uma data-chave, "grudando" no último dia do mês de chegada quando o dia original não existe nele (ex: 31 jan + 1 mês → 28/29 fev). Usado pros vencimentos das parcelas do cartão. */
export function addMonthsClamped(key: string, months: number): string {
  const d = dateFromKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfMonth));
  return toLocalDateKey(d);
}

/** Soma das variáveis livres ÷ 30 = teto de gasto do dia — sem "sobra" acumulada, cada dia começa do zero (ver DAILY em FinanceEntry). */
export function dailyAllowance(variables: { amount: number }[]): number {
  const total = variables.reduce((sum, v) => sum + v.amount, 0);
  return total / 30;
}

export type SavingsDirection = "DEPOSIT" | "WITHDRAWAL";

export type FinanceEntryLite = {
  date: string; // YYYY-MM-DD — vencimento/data que impacta o saldo
  type: EntryType;
  amount: number; // sempre positivo; o sinal é decidido pelo `type` (e por savingsDirection, no caso de SAVINGS)
  recurrence: RecurrenceKind;
  recurrenceEndDate: string | null;
  /** Só relevante quando type=SAVINGS: DEPOSIT tira do saldo, WITHDRAWAL devolve. */
  savingsDirection?: SavingsDirection;
  /** Ocorrências (YYYY-MM-DD) puladas dessa série — "excluir só esse dia" numa recorrência. */
  excludedDates?: string[];
};

const MAX_OCCURRENCES_PER_ENTRY = 5000; // trava de segurança contra recorrência diária num range absurdo

function nextRecurrenceDate(date: Date, recurrence: RecurrenceKind): Date {
  const next = new Date(date);
  switch (recurrence) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      return next;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      return next;
    case "MONTHLY": {
      const day = date.getDate();
      next.setDate(1); // evita overflow (ex: lançamento dia 31 + mensal → fevereiro não tem dia 31)
      next.setMonth(next.getMonth() + 1);
      const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDayOfMonth));
      return next;
    }
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      // NONE não deveria cair aqui (expandOccurrences não itera nesse caso) — devolve algo que não trava.
      next.setDate(next.getDate() + 1);
      return next;
  }
}

/** Datas (YYYY-MM-DD) em que este lançamento (modelo/template) ocorre dentro de [rangeStart, rangeEnd] — pulando as que estiverem em `excludedDates`. */
export function expandOccurrences(
  entry: Pick<FinanceEntryLite, "date" | "recurrence" | "recurrenceEndDate" | "excludedDates">,
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  const entryStart = dateFromKey(entry.date);
  const excluded = entry.excludedDates && entry.excludedDates.length > 0 ? new Set(entry.excludedDates) : null;

  if (entry.recurrence === "NONE") {
    if (excluded?.has(entry.date)) return [];
    return entryStart >= rangeStart && entryStart <= rangeEnd ? [entry.date] : [];
  }

  const hardEnd = entry.recurrenceEndDate ? dateFromKey(entry.recurrenceEndDate) : null;
  const effectiveEnd = hardEnd && hardEnd < rangeEnd ? hardEnd : rangeEnd;
  if (effectiveEnd < entryStart) return [];

  const out: string[] = [];
  let cursor = new Date(entryStart);
  let guard = MAX_OCCURRENCES_PER_ENTRY;
  while (cursor <= effectiveEnd && guard-- > 0) {
    const key = toLocalDateKey(cursor);
    if (cursor >= rangeStart && !excluded?.has(key)) out.push(key);
    cursor = nextRecurrenceDate(cursor, entry.recurrence);
  }
  return out;
}

/** Expande TODOS os lançamentos (recorrentes viram várias ocorrências) dentro do range — usado pra somar por dia. */
export function expandEntries(
  entries: FinanceEntryLite[],
  rangeStart: Date,
  rangeEnd: Date
): { date: string; type: EntryType; amount: number; savingsDirection?: SavingsDirection }[] {
  const out: { date: string; type: EntryType; amount: number; savingsDirection?: SavingsDirection }[] = [];
  for (const entry of entries) {
    for (const dateKey of expandOccurrences(entry, rangeStart, rangeEnd)) {
      out.push({ date: dateKey, type: entry.type, amount: entry.amount, savingsDirection: entry.savingsDirection });
    }
  }
  return out;
}

export type DayTotals = {
  income: number;
  expense: number;
  savings: number;
  dailySpend: number;
  creditCard: number;
};

export function emptyDayTotals(): DayTotals {
  return { income: 0, expense: 0, savings: 0, dailySpend: 0, creditCard: 0 };
}

/** Saldo do dia: entra soma, o resto subtrai — economia também subtrai do saldo disponível (é dinheiro guardado, não gasto, mas sai do "pode gastar"). */
export function netOf(t: DayTotals): number {
  return t.income - t.expense - t.savings - t.dailySpend - t.creditCard;
}

export type DayBreakdown = DayTotals & { date: string; net: number; balance: number };

/**
 * Projeta o saldo dia a dia entre `rangeStart` e `rangeEnd` (inclusive),
 * partindo de `startingBalance` em `startingBalanceDate` e acumulando
 * todo lançamento (já expandido de recorrência) no caminho — inclusive os
 * dias ANTES de rangeStart, só pra chegar no saldo de abertura certo, sem
 * incluir esses dias no resultado.
 *
 * `assumedDailyAllowance`, se informado, faz dias FUTUROS (depois de
 * `today`) sem gasto diário já registrado assumirem esse valor como
 * gasto previsto — a previsão diária funcionando como orçamento pra
 * frente na projeção, não só um teto do dia. Cada dia recebe o valor uma
 * vez só (não acumula de um dia pro outro — "zera à meia-noite"), e HOJE
 * nunca é afetado (fica só com o que foi de fato registrado), então o
 * saldo atual continua sendo real, não uma estimativa.
 */
export function projectHorizon(params: {
  entries: FinanceEntryLite[];
  startingBalance: number;
  startingBalanceDate: string;
  rangeStart: string;
  rangeEnd: string;
  assumedDailyAllowance?: number;
  today?: string;
}): DayBreakdown[] {
  const { entries, startingBalance, startingBalanceDate, rangeStart, rangeEnd, assumedDailyAllowance, today } = params;
  const todayKey = today ?? toLocalDateKey(new Date());
  const spanStartKey = startingBalanceDate < rangeStart ? startingBalanceDate : rangeStart;
  const spanStart = dateFromKey(spanStartKey);
  const rangeStartDate = dateFromKey(rangeStart);
  const end = dateFromKey(rangeEnd);
  if (end < spanStart) return [];

  const occurrences = expandEntries(entries, spanStart, end);
  const byDate = new Map<string, DayTotals>();
  for (const occ of occurrences) {
    const bucket = byDate.get(occ.date) ?? emptyDayTotals();
    switch (occ.type) {
      case "INCOME":
        bucket.income += occ.amount;
        break;
      case "EXPENSE":
        bucket.expense += occ.amount;
        break;
      case "SAVINGS":
        // DEPOSIT soma no "tira do saldo" (padrão); WITHDRAWAL subtrai desse
        // total — resgatar um cofrinho devolve o valor pro saldo disponível.
        bucket.savings += occ.savingsDirection === "WITHDRAWAL" ? -occ.amount : occ.amount;
        break;
      case "DAILY":
        bucket.dailySpend += occ.amount;
        break;
      case "CREDIT_CARD":
        bucket.creditCard += occ.amount;
        break;
    }
    byDate.set(occ.date, bucket);
  }

  const days: DayBreakdown[] = [];
  let running = startingBalance;
  // Se o saldo inicial começa antes de startingBalanceDate estar dentro do range em si (ex: perfil criado antes de startingBalanceDate por engano), não há o que fazer além de confiar na data — startingBalanceDate É o ponto zero.
  const cursor = new Date(spanStart);
  let guard = 3660; // ~10 anos de trava de segurança
  while (cursor <= end && guard-- > 0) {
    const key = toLocalDateKey(cursor);
    const totals = byDate.get(key) ?? emptyDayTotals();
    if (assumedDailyAllowance && assumedDailyAllowance > 0 && key > todayKey && totals.dailySpend === 0) {
      totals.dailySpend = assumedDailyAllowance;
    }
    const net = netOf(totals);
    running += net;
    if (cursor >= rangeStartDate) {
      days.push({ date: key, ...totals, net, balance: running });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Saldo de um cofrinho no período: depósitos − resgates, já expandindo recorrência. */
export function pocketBalance(entries: FinanceEntryLite[], rangeStart: Date, rangeEnd: Date): number {
  const occurrences = expandEntries(entries, rangeStart, rangeEnd);
  return occurrences.reduce((sum, occ) => {
    if (occ.type !== "SAVINGS") return sum;
    return sum + (occ.savingsDirection === "WITHDRAWAL" ? -occ.amount : occ.amount);
  }, 0);
}

/** 0..100 — quanto do valor-alvo de uma meta já foi guardado. */
export function goalProgressPercent(balance: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0;
  return Math.max(0, Math.min(100, (balance / targetAmount) * 100));
}

/**
 * Cor de "mapa de temperatura" pra um valor (saldo, entradas, etc) — escala
 * contínua vermelho (bem negativo) → âmbar (perto de zero) → verde (bem
 * positivo), em oklch, calibrada pelo maior valor absoluto visível no
 * momento (`maxAbs`), não um teto fixo. Cor de texto escolhida pelo
 * contraste com o fundo gerado.
 */
const HEAT_BANDS: { max: number; bg: string; fg: string }[] = [
  { max: 0, bg: "oklch(0.577 0.245 27.325)", fg: "oklch(0.98 0 0)" }, // vermelho: abaixo de zero
  { max: 1000, bg: "oklch(0.795 0.184 86.047)", fg: "oklch(0.15 0 0)" }, // amarelo: 0 a 1k
  { max: 2000, bg: "oklch(0.792 0.209 151.711)", fg: "oklch(0.15 0 0)" }, // verde claro: 1k a 2k
  { max: 3000, bg: "oklch(0.527 0.154 150.069)", fg: "oklch(0.98 0 0)" }, // verde escuro: 2k a 3k
];
const HEAT_GOLD = { bg: "oklch(0.666 0.179 58.318)", fg: "oklch(0.15 0 0)" }; // dourado: 3k+

/** Faixas fixas de valor (não relativas ao maior valor visível): vermelho abaixo de zero, amarelo até 1k, verde claro até 2k, verde escuro até 3k, dourado dali pra cima. */
export function heatColor(value: number): { bg: string; fg: string } {
  for (const band of HEAT_BANDS) {
    if (value < band.max) return { bg: band.bg, fg: band.fg };
  }
  return HEAT_GOLD;
}

/** "ago/26" — cabeçalho de mês no horizonte de saldo. */
export function monthShortLabel(d: Date): string {
  const s = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d);
  return s.replace(".", "");
}

/** Divide um valor em N parcelas, absorvendo o resto de arredondamento na última (ex: 500/3 → 166.67, 166.67, 166.66). */
export function splitInstallments(total: number, count: number): number[] {
  if (count <= 1) return [Math.round(total * 100) / 100];
  const base = Math.floor((total / count) * 100) / 100;
  const installments = Array(count - 1).fill(base);
  const sumSoFar = base * (count - 1);
  const last = Math.round((total - sumSoFar) * 100) / 100;
  return [...installments, last];
}

export type PocketEvolutionPoint = { date: string; principal: number; adjusted: number };

/**
 * Evolução de um cofrinho indexado a %CDI: `principal` é só depósitos −
 * resgates acumulados (sem render nenhum); `adjusted` aplica o CDI do dia
 * (× cdiPercentage/100) compondo diariamente, ANTES de somar o
 * movimento do dia (dinheiro que entra hoje só passa a render a partir de
 * amanhã, convenção padrão de renda fixa). Dias sem taxa publicada
 * (fins de semana/feriados) não rendem nada nesse dia — não inventa taxa.
 */
export function computeCdiEvolution(params: {
  entries: FinanceEntryLite[];
  startingBalance: number;
  startingBalanceDate: string;
  cdiPercentage: number;
  cdiRatesByDate: Map<string, number>;
  rangeEnd: string;
}): PocketEvolutionPoint[] {
  const { entries, startingBalance, startingBalanceDate, cdiPercentage, cdiRatesByDate, rangeEnd } = params;
  const start = dateFromKey(startingBalanceDate);
  const end = dateFromKey(rangeEnd);
  if (end < start) return [];

  const occurrences = expandEntries(entries, start, end);
  const movementByDate = new Map<string, number>();
  for (const occ of occurrences) {
    if (occ.type !== "SAVINGS") continue;
    const delta = occ.savingsDirection === "WITHDRAWAL" ? -occ.amount : occ.amount;
    movementByDate.set(occ.date, (movementByDate.get(occ.date) ?? 0) + delta);
  }

  const points: PocketEvolutionPoint[] = [];
  let principal = startingBalance;
  let adjusted = startingBalance;
  const cursor = new Date(start);
  let guard = 3660;
  while (cursor <= end && guard-- > 0) {
    const key = toLocalDateKey(cursor);
    const dailyRatePercent = cdiRatesByDate.get(key);
    if (dailyRatePercent !== undefined) {
      adjusted *= 1 + (dailyRatePercent / 100) * (cdiPercentage / 100);
    }
    const movement = movementByDate.get(key) ?? 0;
    principal += movement;
    adjusted += movement;
    points.push({ date: key, principal: Math.round(principal * 100) / 100, adjusted: Math.round(adjusted * 100) / 100 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}
