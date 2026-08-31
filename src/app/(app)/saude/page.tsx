"use client";

import useSWR from "swr";
import Link from "next/link";
import { Activity, Droplets, Dumbbell, Flame, CalendarCheck2, Pill, LineChart } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WEEKDAY_LABELS_LONG } from "@/lib/health";

type Summary = {
  profile: { weightKg: number; heightCm: number; waterGoalBottles: number; gymPlanDays: number[] } | null;
  litersThisWeek?: number;
  daysWithWaterThisWeek?: number;
  gymDaysAttendedThisWeek?: number;
  gymDaysMissedThisWeek?: number;
  supplementDaysThisWeek?: number;
  waterStreak?: number;
  gymStreak?: number;
  supplementStreak?: number;
  estimatedCalories?: number;
  maxWorkoutMinutes?: number;
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className={`size-4 ${accent ?? ""}`} /> {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * Dashboard do módulo Saúde: meta de água e de academia bem na frente,
 * junto com a situação atual da semana e os streaks. Nada aqui é
 * orientação médica — são regras gerais (ver src/lib/health.ts).
 */
export default function SaudeDashboardPage() {
  const { data: summary, isLoading } = useSWR<Summary>("/api/health/summary", fetcher);

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-3xl rounded-xl" />
      </div>
    );
  }

  if (!summary?.profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Activity className="size-8" />
        <p className="max-w-sm">Preencha seu peso e altura pra calcular suas metas e começar a acompanhar.</p>
        <Button render={<Link href="/saude/perfil" />}>Preencher perfil</Button>
      </div>
    );
  }

  const planLabel = summary.profile.gymPlanDays.map((d) => WEEKDAY_LABELS_LONG[d].slice(0, 3)).join(", ");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Activity className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Saúde — resumo</h1>
        </div>

        {/* Metas em destaque */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
              <Droplets className="size-4" /> Meta de água
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              {summary.profile.waterGoalBottles} {summary.profile.waterGoalBottles === 1 ? "garrafa" : "garrafas"} / dia
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.profile.waterGoalBottles}L de 1L cada — ajustável no perfil.
            </p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
              <Dumbbell className="size-4" /> Meta de academia
            </div>
            <p className="text-2xl font-semibold tracking-tight">{summary.profile.gymPlanDays.length}x / semana</p>
            <p className="mt-1 text-xs text-muted-foreground">{planLabel || "Nenhum dia planejado ainda"}</p>
          </div>
        </div>

        {/* Situação atual */}
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground">Sua situação esta semana</h2>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={Droplets}
            label="Água tomada"
            value={`${summary.litersThisWeek?.toFixed(1)}L`}
            sub={`${summary.daysWithWaterThisWeek}/7 dias na meta`}
            accent="text-primary"
          />
          <StatCard
            icon={Dumbbell}
            label="Academia"
            value={`${summary.gymDaysAttendedThisWeek}x`}
            sub={
              summary.gymDaysMissedThisWeek
                ? `${summary.gymDaysMissedThisWeek} ${summary.gymDaysMissedThisWeek === 1 ? "falta" : "faltas"} planejada(s)`
                : "Sem faltas até agora"
            }
            accent="text-primary"
          />
          <StatCard
            icon={Pill}
            label="Suplementação"
            value={`${summary.supplementDaysThisWeek}/7`}
            sub="dias marcados na semana"
            accent="text-primary"
          />
          <StatCard
            icon={CalendarCheck2}
            label="Streak de água"
            value={`${summary.waterStreak} ${summary.waterStreak === 1 ? "dia" : "dias"}`}
            sub="seguidos batendo a meta"
            accent="text-primary"
          />
          <StatCard
            icon={CalendarCheck2}
            label="Streak de academia"
            value={`${summary.gymStreak} ${summary.gymStreak === 1 ? "dia" : "dias"}`}
            sub="planejados seguidos sem falta"
            accent="text-primary"
          />
          <StatCard
            icon={CalendarCheck2}
            label="Streak de suplemento"
            value={`${summary.supplementStreak} ${summary.supplementStreak === 1 ? "dia" : "dias"}`}
            sub="seguidos sem esquecer"
            accent="text-primary"
          />
        </div>

        {/* Estimativa de calorias */}
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Flame className="size-4 text-primary" /> Estimativa de calorias
          </div>
          <p className="text-2xl font-semibold tracking-tight">~{summary.estimatedCalories} kcal</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Num treino de até {summary.maxWorkoutMinutes} min, intensidade moderada — é só uma estimativa aproximada
            (varia bastante com o tipo de treino), não é orientação profissional.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/saude/semana" />}>
            Ver semana
          </Button>
          <Button variant="outline" render={<Link href="/saude/caderno" />}>
            Abrir caderno
          </Button>
          <Button variant="outline" render={<Link href="/saude/historico" />}>
            <LineChart /> Histórico
          </Button>
        </div>
      </div>
    </div>
  );
}
