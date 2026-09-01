"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Thermometer } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { heatColor, monthShortLabel, toLocalDateKey } from "@/lib/finance";
import { cn } from "@/lib/utils";

type DayBreakdown = {
  date: string;
  income: number;
  expense: number;
  savings: number;
  dailySpend: number;
  creditCard: number;
  net: number;
  balance: number;
};
type HorizonResponse = { profile: unknown | null; days: DayBreakdown[] };

const METRICS = [
  { key: "balance", label: "Saldo final" },
  { key: "income", label: "Entradas" },
  { key: "expense", label: "Saídas" },
  { key: "dailySpend", label: "Diário" },
  { key: "creditCard", label: "Cartão" },
  { key: "savings", label: "Economias" },
  { key: "net", label: "Líquido do dia" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

const WEEKDAY_HEADERS = ["D", "S", "T", "Q", "Q", "S", "S"];

function money(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildMonthWeeks(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const cells: (string | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toLocalDateKey(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Horizonte de saldo — mapa de temperatura por dia (vermelho..âmbar..verde
 * conforme o valor), com um seletor de métrica pra ver entradas/saídas/
 * economias/cartão separados ou o saldo final combinado. Clique num dia
 * pra ver o detalhamento completo. Mobile mostra 3 meses por página,
 * desktop mostra 6 (ver useIsMobile).
 */
export default function HorizontePage() {
  const isMobile = useIsMobile();
  const monthsPerPage = isMobile ? 3 : 6;
  const [anchor, setAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [metric, setMetric] = useState<MetricKey>("balance");
  const [selectedDay, setSelectedDay] = useState<DayBreakdown | null>(null);

  const months = useMemo(
    () => Array.from({ length: monthsPerPage }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth() + i, 1)),
    [anchor, monthsPerPage]
  );
  const fromKey = toLocalDateKey(months[0]);
  const lastMonth = months[months.length - 1];
  const toKey = toLocalDateKey(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0));

  const { data, isLoading } = useSWR<HorizonResponse>(`/api/finance/horizon?from=${fromKey}&to=${toKey}`, fetcher);
  const byDate = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d])), [data]);
  const maxAbs = useMemo(() => {
    let m = 0;
    for (const d of data?.days ?? []) {
      const v = Math.abs(d[metric]);
      if (v > m) m = v;
    }
    return m;
  }, [data, metric]);

  function shiftMonths(delta: number) {
    setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  if (!isLoading && data && data.profile === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Thermometer className="size-8" />
        <p className="max-w-sm">Preencha seu saldo inicial no perfil pra calcular o horizonte de saldo.</p>
        <Button render={<Link href="/financeiro/perfil" />}>Preencher perfil</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Thermometer className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Horizonte de saldo</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={metric} onValueChange={(v) => setMetric((v as MetricKey) ?? "balance")}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue>{() => METRICS.find((m) => m.key === metric)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => shiftMonths(-monthsPerPage)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => shiftMonths(monthsPerPage)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {months.map((m) => (
              <MonthGrid
                key={`${m.getFullYear()}-${m.getMonth()}`}
                month={m}
                byDate={byDate}
                metric={metric}
                maxAbs={maxAbs}
                onSelect={setSelectedDay}
              />
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Cor calibrada pelo maior valor absoluto visível na página atual — clique num dia pra ver o detalhamento
          completo (entradas, saídas, diário, cartão, economias e saldo).
        </p>
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-sm">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedDay.date.slice(8, 10)}/{selectedDay.date.slice(5, 7)}/{selectedDay.date.slice(0, 4)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5 text-sm">
                <Row label="Entradas" value={selectedDay.income} positive />
                <Row label="Saídas" value={selectedDay.expense} />
                <Row label="Diário" value={selectedDay.dailySpend} />
                <Row label="Cartão" value={selectedDay.creditCard} />
                <Row label="Economias" value={selectedDay.savings} neutral />
                <div className="my-1 border-t" />
                <Row label="Líquido do dia" value={selectedDay.net} neutral bold />
                <Row label="Saldo final" value={selectedDay.balance} neutral bold />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, positive, neutral, bold }: { label: string; value: number; positive?: boolean; neutral?: boolean; bold?: boolean }) {
  const color = neutral ? (value < 0 ? "text-destructive" : "text-primary") : positive ? "text-primary" : "text-destructive";
  return (
    <div className={cn("flex items-center justify-between", bold && "font-semibold")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", color)}>{money(value)}</span>
    </div>
  );
}

function MonthGrid({
  month,
  byDate,
  metric,
  maxAbs,
  onSelect,
}: {
  month: Date;
  byDate: Map<string, DayBreakdown>;
  metric: MetricKey;
  maxAbs: number;
  onSelect: (d: DayBreakdown) => void;
}) {
  const weeks = useMemo(() => buildMonthWeeks(month.getFullYear(), month.getMonth()), [month]);
  const todayKey = toLocalDateKey(new Date());

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 text-center text-xs font-semibold text-muted-foreground">{monthShortLabel(month)}</div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_HEADERS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((dateKey, di) => {
              if (!dateKey) return <div key={di} />;
              const day = byDate.get(dateKey);
              const value = day ? day[metric] : 0;
              const { bg, fg } = heatColor(value, maxAbs);
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => day && onSelect(day)}
                  style={day ? { backgroundColor: bg, color: fg } : undefined}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-[11px] font-medium transition-transform hover:scale-110",
                    !day && "bg-muted/40 text-muted-foreground",
                    dateKey === todayKey && "ring-2 ring-foreground/40"
                  )}
                >
                  {Number(dateKey.slice(8, 10))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
