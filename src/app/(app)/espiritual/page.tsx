"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  BookMarked,
  BookOpenText,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Church,
  HandHeart,
  Hourglass,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toLocalDateKey, WEEKDAY_LABELS_LONG } from "@/lib/spiritual";

function shortDate(dateKey: string) {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

type Summary = {
  profile: { churchPlanDays: number[] } | null;
  weekStart?: string;
  weekEnd?: string;
  isCurrentWeek?: boolean;
  prayerDaysThisWeek?: number;
  devotionalDaysThisWeek?: number;
  churchDaysAttendedThisWeek?: number;
  churchDaysMissedThisWeek?: number;
  prayerStreak?: number;
  devotionalStreak?: number;
  churchStreak?: number;
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4 text-primary" /> {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * Dashboard do módulo Espiritual: streaks de oração/devocional/igreja em
 * destaque, situação da semana navegável (mesmo padrão da Saúde), e
 * atalhos pras outras abas (Sermões, Bíblia, Versículos, Pedidos).
 */
export default function EspiritualDashboardPage() {
  const [anchor, setAnchor] = useState(() => toLocalDateKey(new Date()));
  const { data: summary, isLoading } = useSWR<Summary>(`/api/spiritual/summary?date=${anchor}`, fetcher);

  function shiftWeek(deltaWeeks: number) {
    const [y, m, d] = anchor.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + deltaWeeks * 7);
    setAnchor(toLocalDateKey(date));
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-3xl rounded-xl" />
      </div>
    );
  }

  const planLabel = (summary?.profile?.churchPlanDays ?? [0, 2, 4])
    .map((d) => WEEKDAY_LABELS_LONG[d].slice(0, 3))
    .join(", ");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Espiritual — resumo</h1>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={HandHeart}
            label="Streak de oração"
            value={`${summary?.prayerStreak ?? 0} ${summary?.prayerStreak === 1 ? "dia" : "dias"}`}
            sub="acordar + dormir seguidos"
          />
          <StatCard
            icon={NotebookPen}
            label="Streak de devocional"
            value={`${summary?.devotionalStreak ?? 0} ${summary?.devotionalStreak === 1 ? "dia" : "dias"}`}
            sub="dias seguidos"
          />
          <StatCard
            icon={Church}
            label="Streak de igreja"
            value={`${summary?.churchStreak ?? 0} ${summary?.churchStreak === 1 ? "dia" : "dias"}`}
            sub={planLabel || "Nenhum dia planejado"}
          />
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
            {summary?.isCurrentWeek
              ? "Sua situação esta semana"
              : `Semana de ${shortDate(summary?.weekStart ?? anchor)} a ${shortDate(summary?.weekEnd ?? anchor)}`}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftWeek(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            {!summary?.isCurrentWeek && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAnchor(toLocalDateKey(new Date()))}>
                Hoje
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-7" disabled={summary?.isCurrentWeek} onClick={() => shiftWeek(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={HandHeart}
            label="Dias de oração completa"
            value={`${summary?.prayerDaysThisWeek ?? 0}/7`}
            sub="acordar e dormir, no mesmo dia"
          />
          <StatCard
            icon={NotebookPen}
            label="Devocional"
            value={`${summary?.devotionalDaysThisWeek ?? 0}/7`}
            sub="dias feitos na semana"
          />
          <StatCard
            icon={Church}
            label="Igreja"
            value={`${summary?.churchDaysAttendedThisWeek ?? 0}x`}
            sub={
              summary?.churchDaysMissedThisWeek
                ? `${summary.churchDaysMissedThisWeek} ${summary.churchDaysMissedThisWeek === 1 ? "falta" : "faltas"} planejada(s)`
                : "Sem faltas até agora"
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/espiritual/semana" />}>
            <CalendarCheck2 /> Ver semana
          </Button>
          <Button variant="outline" render={<Link href="/espiritual/sermoes" />}>
            <BookOpenText /> Sermões
          </Button>
          <Button variant="outline" render={<Link href="/espiritual/biblia" />}>
            <BookMarked /> Bíblia
          </Button>
          <Button variant="outline" render={<Link href="/espiritual/versiculos" />}>
            <Hourglass /> Versículos
          </Button>
          <Button variant="outline" render={<Link href="/espiritual/oracoes" />}>
            <HandHeart /> Pedidos de oração
          </Button>
        </div>
      </div>
    </div>
  );
}
