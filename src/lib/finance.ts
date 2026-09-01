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

/** Datas (YYYY-MM-DD) em que este lançamento (modelo/template) ocorre dentro de [rangeStart, rangeEnd]. */
export function expandOccurrences(
  entry: Pick<FinanceEntryLite, "date" | "recurrence" | "recurrenceEndDate">,
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  const entryStart = dateFromKey(entry.date);

  if (entry.recurrence === "NONE") {
    return entryStart >= rangeStart && entryStart <= rangeEnd ? [entry.date] : [];
  }

  const hardEnd = entry.recurrenceEndDate ? dateFromKey(entry.recurrenceEndDate) : null;
  const effectiveEnd = hardEnd && hardEnd < rangeEnd ? hardEnd : rangeEnd;
  if (effectiveEnd < entryStart) return [];

  const out: string[] = [];
  let cursor = new Date(entryStart);
  let guard = MAX_OCCURRENCES_PER_ENTRY;
  while (cursor <= effectiveEnd && guard-- > 0) {
    if (cursor >= rangeStart) out.push(toLocalDateKey(cursor));
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
 */
export function projectHorizon(params: {
  entries: FinanceEntryLite[];
  startingBalance: number;
  startingBalanceDate: string;
  rangeStart: string;
  rangeEnd: string;
}): DayBreakdown[] {
  const { entries, startingBalance, startingBalanceDate, rangeStart, rangeEnd } = params;
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
export function heatColor(value: number, maxAbs: number): { bg: string; fg: string } {
  const safeMax = maxAbs > 0 ? maxAbs : 1;
  const t = Math.max(-1, Math.min(1, value / safeMax));
  let hue: number;
  let chroma: number;
  let lightness: number;

  if (t < 0) {
    const k = 1 + t; // 0 (bem negativo) .. 1 (perto de zero)
    hue = 27 + k * (70 - 27);
    chroma = 0.19 - k * 0.03;
    lightness = 0.5 + k * 0.15;
  } else {
    const k = t; // 0 (perto de zero) .. 1 (bem positivo)
    hue = 70 + k * (142 - 70);
    chroma = 0.16 + k * 0.03;
    lightness = 0.65 - k * 0.1;
  }

  const bg = `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
  const fg = lightness > 0.6 ? "oklch(0.15 0 0)" : "oklch(0.98 0 0)";
  return { bg, fg };
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
