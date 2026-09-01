"use client";

import useSWR from "swr";
import { Info, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { computeWeightTrend, predictWeight } from "@/lib/health";
import { cn } from "@/lib/utils";

type HistoryEntry = { id: string; weightKg: number; recordedAt: string };

const HORIZONS_DAYS = [30, 60, 90, 180];

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function horizonLabel(days: number) {
  if (days === 30) return "em 1 mês";
  if (days === 60) return "em 2 meses";
  if (days === 90) return "em 3 meses";
  return "em 6 meses";
}

/**
 * Previsão de peso — regressão linear simples (mínimos quadrados) sobre o
 * histórico de checkpoints mensais (ver src/lib/health.ts). De propósito
 * NÃO é um modelo sofisticado: com um punhado de registros por mês, uma
 * reta é a ferramenta honesta, não "machine learning" de verdade — e é
 * isso que a UI deixa claro, com faixa de incerteza em vez de um número
 * seco.
 */
export default function PrevisaoSaudePage() {
  const { data: entries, isLoading } = useSWR<HistoryEntry[]>("/api/health/history", fetcher);

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  const trend = entries ? computeWeightTrend(entries.map((e) => ({ recordedAt: e.recordedAt, weightKg: e.weightKg }))) : null;

  if (!trend) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <TrendingUp className="size-8" />
        <p className="max-w-sm text-sm">
          Precisa de pelo menos 2 registros de perfil em datas diferentes pra calcular uma tendência. Salve o peso em{" "}
          Perfil agora, volte no próximo checkpoint mensal (ver Histórico) e a previsão aparece aqui.
        </p>
      </div>
    );
  }

  const now = new Date();
  const currentWeight = entries![0].weightKg; // mais recente primeiro
  const weeklyRate = trend.slopePerWeek;
  const stable = Math.abs(weeklyRate) < 0.05;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <TrendingUp className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Previsão de peso</h1>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Tendência atual ({trend.n} registros desde {formatDate(trend.firstDate)})
          </div>
          <div className="flex items-baseline gap-2">
            {stable ? (
              <>
                <Minus className="size-5 text-primary" />
                <span className="text-2xl font-semibold tracking-tight">Peso estável</span>
              </>
            ) : (
              <>
                {weeklyRate < 0 ? (
                  <TrendingDown className="size-5 text-primary" />
                ) : (
                  <TrendingUp className="size-5 text-primary" />
                )}
                <span className="text-2xl font-semibold tracking-tight">
                  {weeklyRate > 0 ? "+" : ""}
                  {weeklyRate.toFixed(2)}kg / semana
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Peso mais recente: {currentWeight}kg.</p>
        </div>

        <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground">
          Se esse ritmo continuar assim...
        </h2>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {HORIZONS_DAYS.map((days) => {
            const target = new Date(now);
            target.setDate(target.getDate() + days);
            const { estimate, low, high } = predictWeight(trend, target);
            return (
              <div key={days} className="rounded-xl border bg-card p-4">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {horizonLabel(days)} ({formatDate(target)})
                </div>
                <div className="text-2xl font-semibold tracking-tight">{estimate.toFixed(1)}kg</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  faixa aproximada: {low.toFixed(1)}–{high.toFixed(1)}kg
                </p>
              </div>
            );
          })}
        </div>

        <div className={cn("flex items-start gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground")}>
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Isso é uma extrapolação estatística simples (regressão linear) sobre os registros que você salvou — não é
            orientação médica nem contabiliza mudanças de rotina, é só &ldquo;se o ritmo dos últimos registros
            continuar do jeito que está&rdquo;. Poucos registros ({trend.n}) deixam a faixa de incerteza mais larga;
            quanto mais checkpoints mensais você salvar, mais confiável a tendência fica.
          </p>
        </div>
      </div>
    </div>
  );
}
