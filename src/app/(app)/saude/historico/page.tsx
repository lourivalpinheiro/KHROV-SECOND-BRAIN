"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from "recharts";
import { BellRing, CircleCheck, LineChart, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { WEEKDAY_LABELS_LONG } from "@/lib/health";
import { cn } from "@/lib/utils";

type HistoryEntry = {
  id: string;
  weightKg: number;
  heightCm: number;
  waterGoalBottles: number;
  gymPlanDays: number[];
  recordedAt: string;
};

const weightChartConfig = {
  weightKg: { label: "Peso (kg)", color: "var(--primary)" },
} satisfies ChartConfig;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function Delta({ value, unit }: { value: number; unit: string }) {
  if (Math.abs(value) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="size-3" /> igual
      </span>
    );
  }
  const down = value < 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5", down ? "text-primary" : "text-destructive")}>
      {down ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
      {down ? "" : "+"}
      {value.toFixed(1)}
      {unit}
    </span>
  );
}

/**
 * Lembrete de checkpoint mensal — sem registro novo no mês corrente, o
 * histórico vira uma lista de datas aleatórias em vez de uma comparação
 * mês a mês de verdade. Convite gentil pra atualizar o perfil perto do
 * fim do mês, não um bloqueio.
 */
function MonthlyCheckpoint({ entries }: { entries: HistoryEntry[] }) {
  const now = new Date();
  const hasRecordThisMonth = entries.some((e) => {
    const d = new Date(e.recordedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now);

  if (hasRecordThisMonth) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
        <CircleCheck className="size-3.5 shrink-0 text-primary" />
        Checkpoint de {monthLabel} já registrado — próximo em {new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(now.getFullYear(), now.getMonth() + 1, 1))}.
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-2">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium">Checkpoint de {monthLabel} pendente</p>
          <p className="text-xs text-muted-foreground">
            {daysLeft > 0
              ? `Atualize peso e altura no perfil pra fechar o registro do mês — faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}.`
              : "Último dia do mês — atualize agora pra não ficar sem o registro de " + monthLabel + "."}
          </p>
        </div>
      </div>
      <Button size="sm" className="shrink-0" render={<Link href="/saude/perfil" />}>
        Atualizar perfil
      </Button>
    </div>
  );
}

/**
 * Histórico de evolução — um snapshot toda vez que o perfil (peso, altura,
 * metas) é salvo em /saude/perfil. Diferente da Semana (que reseta toda
 * segunda), isso guarda tudo a longo prazo pra comparar de onde saiu até
 * onde chegou — com um lembrete pra registrar um checkpoint todo fim de
 * mês, senão o histórico fica com buracos e a comparação perde sentido.
 */
export default function HistoricoSaudePage() {
  const { data: entries, isLoading } = useSWR<HistoryEntry[]>("/api/health/history", fetcher);
  const [yearFilter, setYearFilter] = useState<string>("all");

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6 flex items-center gap-2">
            <LineChart className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Histórico</h1>
          </div>
          <MonthlyCheckpoint entries={[]} />
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <p className="max-w-sm text-sm">
              Ainda não há histórico — cada vez que você salvar o perfil em Perfil, um registro fica guardado aqui.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const years = Array.from(new Set(entries.map((e) => new Date(e.recordedAt).getFullYear()))).sort((a, b) => b - a);
  const filtered = yearFilter === "all" ? entries : entries.filter((e) => new Date(e.recordedAt).getFullYear() === Number(yearFilter));

  // filtered vem do mais recente pro mais antigo.
  const oldest = filtered[filtered.length - 1];
  const newest = filtered[0];
  const totalWeightDelta = newest && oldest ? newest.weightKg - oldest.weightKg : 0;
  const showTotal = filtered.length > 1;
  // Gráfico quer ordem cronológica (mais antigo primeiro), ao contrário da lista.
  const chartData = [...filtered].reverse().map((e) => ({ date: e.recordedAt, weightKg: e.weightKg }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LineChart className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Histórico</h1>
          </div>
          {years.length > 1 && (
            <Select value={yearFilter} onValueChange={(v) => setYearFilter(v ?? "all")}>
              <SelectTrigger size="sm" className="w-28">
                <SelectValue>{() => (yearFilter === "all" ? "Todos os anos" : yearFilter)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os anos</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <MonthlyCheckpoint entries={entries} />

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="mb-3 text-xs font-medium text-muted-foreground">Peso ao longo do tempo</div>
          <ChartContainer config={weightChartConfig} className="aspect-auto h-56 w-full">
            <RechartsLineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => {
                  const d = new Date(value);
                  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                domain={["dataMin - 2", "dataMax + 2"]}
                tickFormatter={(v: number) => `${v}kg`}
              />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatDate(String(value))} />} />
              <Line dataKey="weightKg" type="monotone" stroke="var(--color-weightKg)" strokeWidth={2} dot={{ r: 3 }} />
            </RechartsLineChart>
          </ChartContainer>
        </div>

        {showTotal && (
          <div className="mb-6 rounded-xl border bg-card p-4">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Desde o primeiro registro ({formatDate(oldest.recordedAt)})</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">{newest.weightKg}kg</span>
              <Delta value={totalWeightDelta} unit="kg" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((entry, i) => {
            const prev = filtered[i + 1];
            const planLabel = entry.gymPlanDays.map((d) => WEEKDAY_LABELS_LONG[d].slice(0, 3)).join(", ") || "—";
            return (
              <div key={entry.id} className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{formatDate(entry.recordedAt)}</span>
                  {prev && <Delta value={entry.weightKg - prev.weightKg} unit="kg desde o registro anterior" />}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>
                    Peso: <span className="text-foreground">{entry.weightKg}kg</span>
                  </span>
                  <span>
                    Altura: <span className="text-foreground">{entry.heightCm}cm</span>
                  </span>
                  <span>
                    Meta água: <span className="text-foreground">{entry.waterGoalBottles} garrafas</span>
                  </span>
                  <span className="col-span-2 sm:col-span-1">
                    Academia: <span className="text-foreground">{planLabel}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
