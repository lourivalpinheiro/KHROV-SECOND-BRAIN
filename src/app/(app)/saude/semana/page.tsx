"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { CalendarCheck2, Check, Droplet, Droplets, Dumbbell } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { WEEKDAY_LABELS, toLocalDateKey } from "@/lib/health";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DayRecord = { date: string; waterBottles: number; gym: boolean; notes: string };
type HealthProfile = { gymPlanDays: number[]; waterGoalBottles: number } | null;

/**
 * A semana atual (Dom..Sáb): água em garrafas de 1L (clique num dia abre
 * as garrafinhas pra marcar quantas já bebeu) e academia num checkbox
 * simples. Sempre os 7 dias — os dias planejados de academia (ver
 * /saude/perfil) só ganham um destaque visual, marcar fora do plano
 * nunca é bloqueado.
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <CalendarCheck2 className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Semana</h1>
        </div>

        <div className="overflow-x-auto">
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
                {(days ?? []).map((d) => {
                  const hit = d.waterBottles >= goalBottles;
                  return (
                    <td key={d.date} className="text-center">
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            "mx-auto flex size-8 items-center justify-center rounded-lg border-2 text-xs font-medium transition-colors",
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
                    </td>
                  );
                })}
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
                            ? "border-chart-2 bg-chart-2 text-white"
                            : planned
                              ? "border-chart-2/50 text-chart-2/60 hover:border-chart-2"
                              : "border-dashed text-muted-foreground/40 hover:border-chart-2/40"
                        )}
                      >
                        {d.gym && <Check className="size-4" />}
                      </button>
                    </td>
                  );
                })}
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
