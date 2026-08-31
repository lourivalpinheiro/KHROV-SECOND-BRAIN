"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { CalendarCheck2, Check, Droplet, Droplets, Dumbbell, Pill } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { WEEKDAY_LABELS, WEEKDAY_LABELS_LONG, toLocalDateKey } from "@/lib/health";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DayRecord = { date: string; waterBottles: number; gym: boolean; supplement: boolean; notes: string };
type HealthProfile = { gymPlanDays: number[]; waterGoalBottles: number } | null;

/**
 * A semana atual (Dom..Sáb): água em garrafas de 1L (clique num dia abre
 * as garrafinhas pra marcar quantas já bebeu), academia e suplementação em
 * checkboxes simples. Sempre os 7 dias — os dias planejados de academia
 * (ver /saude/perfil) só ganham um destaque visual, marcar fora do plano
 * nunca é bloqueado. Em telas pequenas vira uma lista de cartões por dia
 * em vez da tabela (mais fácil de tocar do que 7 colunas espremidas).
 */
export default function SemanaSaudePage() {
  const { data: days, isLoading } = useSWR<DayRecord[]>("/api/health/days", fetcher);
  const { data: profile } = useSWR<HealthProfile>("/api/health/profile", fetcher);
  const todayKey = toLocalDateKey(new Date());
  const planDays = profile?.gymPlanDays ?? [];
  const goalBottles = profile?.waterGoalBottles ?? 4;

  async function setBottles(day: DayRecord, waterBottles: number) {
    const optimistic = days?.map((d) => (d.date === day.date ? { ...d, waterBottles } : d));
    mutate("/api/health/days", optimistic, { revalidate: false });
    try {
      await patchJSON("/api/health/days", { date: day.date, waterBottles });
      await mutate("/api/health/summary");
      await mutate("/api/health/days");
    } catch {
      await mutate("/api/health/days");
    }
  }

  async function toggleGym(day: DayRecord) {
    const optimistic = days?.map((d) => (d.date === day.date ? { ...d, gym: !d.gym } : d));
    mutate("/api/health/days", optimistic, { revalidate: false });
    try {
      await patchJSON("/api/health/days", { date: day.date, gym: !day.gym });
      await mutate("/api/health/summary");
      await mutate("/api/health/days");
    } catch {
      await mutate("/api/health/days");
    }
  }

  async function toggleSupplement(day: DayRecord) {
    const optimistic = days?.map((d) => (d.date === day.date ? { ...d, supplement: !d.supplement } : d));
    mutate("/api/health/days", optimistic, { revalidate: false });
    try {
      await patchJSON("/api/health/days", { date: day.date, supplement: !day.supplement });
      await mutate("/api/health/summary");
      await mutate("/api/health/days");
    } catch {
      await mutate("/api/health/days");
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <CalendarCheck2 className="size-8" />
        <p>
          Preencha seu{" "}
          <Link href="/saude/perfil" className="text-primary hover:underline">
            perfil de saúde
          </Link>{" "}
          primeiro pra calcular sua meta.
        </p>
      </div>
    );
  }

  function BottlesPopover({ d }: { d: DayRecord }) {
    const hit = d.waterBottles >= goalBottles;
    return (
      <Popover>
        <PopoverTrigger
          className={cn(
            "flex size-8 items-center justify-center rounded-lg border-2 text-xs font-medium transition-colors",
            hit
              ? "border-primary bg-primary text-primary-foreground"
              : d.waterBottles > 0
                ? "border-primary/50 text-primary"
                : "border-dashed text-muted-foreground/40 hover:border-primary/40"
          )}
        >
          {d.waterBottles}/{goalBottles}
        </PopoverTrigger>
        <PopoverContent className="w-auto">
          <p className="mb-2 px-0.5 text-xs text-muted-foreground">{d.date}</p>
          <div className="flex gap-1.5">
            {Array.from({ length: goalBottles }, (_, i) => {
              const filled = i < d.waterBottles;
              return (
                <button
                  key={i}
                  type="button"
                  title={`Garrafa ${i + 1}`}
                  onClick={() => setBottles(d, filled && i === d.waterBottles - 1 ? i : i + 1)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg border-2 transition-colors",
                    filled
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-dashed text-muted-foreground/40 hover:border-primary/40"
                  )}
                >
                  <Droplet className={cn("size-4", filled && "fill-current")} />
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <CalendarCheck2 className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Semana</h1>
        </div>

        {/* Mobile: lista de cartões, um por dia — mais fácil de tocar do
            que uma tabela de 7 colunas espremida numa tela estreita. */}
        <div className="space-y-2 sm:hidden">
          {(days ?? []).map((d) => {
            const dayOfWeek = new Date(`${d.date}T00:00:00`).getDay();
            const planned = planDays.includes(dayOfWeek);
            const isToday = d.date === todayKey;
            return (
              <div
                key={d.date}
                className={cn("flex items-center justify-between gap-3 rounded-xl border bg-card p-3", isToday && "border-primary/40")}
              >
                <div className="min-w-0">
                  <div className={cn("text-sm font-medium", isToday && "text-primary")}>
                    {WEEKDAY_LABELS_LONG[dayOfWeek]}
                    {isToday && " (hoje)"}
                  </div>
                  <div className="text-xs text-muted-foreground">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <BottlesPopover d={d} />
                  <button
                    type="button"
                    onClick={() => toggleGym(d)}
                    title={planned ? "Academia (planejado)" : "Academia"}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border-2 transition-colors",
                      d.gym
                        ? "border-primary bg-primary text-white"
                        : planned
                          ? "border-primary/50 text-primary/60"
                          : "border-dashed text-muted-foreground/40"
                    )}
                  >
                    {d.gym ? <Check className="size-4" /> : <Dumbbell className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSupplement(d)}
                    title="Suplementação"
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border-2 transition-colors",
                      d.supplement ? "border-primary bg-primary text-white" : "border-dashed text-muted-foreground/40"
                    )}
                  >
                    {d.supplement ? <Check className="size-4" /> : <Pill className="size-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop/tablet: tabela de verdade. */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[480px] border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="w-28 text-left text-xs font-medium text-muted-foreground"></th>
                {(days ?? []).map((d) => {
                  const dayOfWeek = new Date(`${d.date}T00:00:00`).getDay();
                  return (
                    <th key={d.date} className="text-center text-xs font-medium text-muted-foreground">
                      <div className={cn(d.date === todayKey && "text-primary")}>{WEEKDAY_LABELS[dayOfWeek]}</div>
                      <div className="font-normal">{d.date.slice(8, 10)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
                  <Droplets className="size-3.5" /> Água
                </td>
                {(days ?? []).map((d) => (
                  <td key={d.date} className="text-center">
                    <div className="mx-auto flex w-fit">
                      <BottlesPopover d={d} />
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
                  <Dumbbell className="size-3.5" /> Academia
                </td>
                {(days ?? []).map((d) => {
                  const dayOfWeek = new Date(`${d.date}T00:00:00`).getDay();
                  const planned = planDays.includes(dayOfWeek);
                  return (
                    <td key={d.date} className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleGym(d)}
                        title={planned ? `${d.date} (planejado)` : d.date}
                        className={cn(
                          "mx-auto flex size-8 items-center justify-center rounded-lg border-2 transition-colors",
                          d.gym
                            ? "border-primary bg-primary text-white"
                            : planned
                              ? "border-primary/50 text-primary/60 hover:border-primary"
                              : "border-dashed text-muted-foreground/40 hover:border-primary/40"
                        )}
                      >
                        {d.gym && <Check className="size-4" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
                  <Pill className="size-3.5" /> Suplemento
                </td>
                {(days ?? []).map((d) => (
                  <td key={d.date} className="text-center">
                    <button
                      type="button"
                      onClick={() => toggleSupplement(d)}
                      title={d.date}
                      className={cn(
                        "mx-auto flex size-8 items-center justify-center rounded-lg border-2 transition-colors",
                        d.supplement
                          ? "border-primary bg-primary text-white"
                          : "border-dashed text-muted-foreground/40 hover:border-primary/40"
                      )}
                    >
                      {d.supplement && <Check className="size-4" />}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Clique no número da água pra marcar as garrafas do dia, uma a uma. Dias de academia com contorno mais forte
          são os planejados — marcar qualquer outro dia também conta, sem bloqueio nenhum.
        </p>
      </div>
    </div>
  );
}
