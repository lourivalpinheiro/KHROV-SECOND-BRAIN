"use client";

import useSWR, { mutate } from "swr";
import { CalendarCheck2, Check, Church, Moon, NotebookPen, Sunrise } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { WEEKDAY_LABELS, WEEKDAY_LABELS_LONG, toLocalDateKey } from "@/lib/spiritual";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DayRecord = { date: string; prayerMorning: boolean; prayerNight: boolean; devotional: boolean; churchAttended: boolean };
type SpiritualProfile = { churchPlanDays: number[] } | null;

const FIELDS = [
  { key: "prayerMorning" as const, label: "Oração ao acordar", icon: Sunrise },
  { key: "prayerNight" as const, label: "Oração antes de dormir", icon: Moon },
  { key: "devotional" as const, label: "Devocional", icon: NotebookPen },
  { key: "churchAttended" as const, label: "Igreja", icon: Church },
];

/**
 * A semana atual (Dom..Sáb): quatro checkboxes por dia — as duas orações
 * separadas (acordar/dormir), devocional e presença na igreja. Os dias
 * planejados de igreja (ver /espiritual/perfil) só ganham destaque
 * visual, marcar fora do plano nunca é bloqueado — mesma regra da
 * academia na Saúde.
 */
export default function SemanaEspiritualPage() {
  const { data: days, isLoading } = useSWR<DayRecord[]>("/api/spiritual/days", fetcher);
  const { data: profile } = useSWR<SpiritualProfile>("/api/spiritual/profile", fetcher);
  const todayKey = toLocalDateKey(new Date());
  const planDays = profile?.churchPlanDays ?? [0, 2, 4];

  async function toggle(day: DayRecord, field: (typeof FIELDS)[number]["key"]) {
    const nextValue = !day[field];
    const optimistic = days?.map((d) => (d.date === day.date ? { ...d, [field]: nextValue } : d));
    mutate("/api/spiritual/days", optimistic, { revalidate: false });
    try {
      await patchJSON("/api/spiritual/days", { date: day.date, [field]: nextValue });
      await mutate("/api/spiritual/summary");
      await mutate("/api/spiritual/days");
    } catch {
      await mutate("/api/spiritual/days");
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  function Dot({ d, field }: { d: DayRecord; field: (typeof FIELDS)[number]["key"]; }) {
    const meta = FIELDS.find((f) => f.key === field)!;
    const Icon = meta.icon;
    const on = d[field];
    const planned = field === "churchAttended" && planDays.includes(new Date(`${d.date}T00:00:00`).getDay());
    return (
      <button
        type="button"
        onClick={() => toggle(d, field)}
        title={meta.label}
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border-2 transition-colors",
          on
            ? "border-primary bg-primary text-primary-foreground"
            : planned
              ? "border-primary/50 text-primary/60 hover:border-primary"
              : "border-dashed text-muted-foreground/40 hover:border-primary/40"
        )}
      >
        {on ? <Check className="size-4" /> : <Icon className="size-3.5" />}
      </button>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <CalendarCheck2 className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Semana</h1>
        </div>

        {/* Mobile: cartão por dia. */}
        <div className="space-y-2 sm:hidden">
          {(days ?? []).map((d) => {
            const dayOfWeek = new Date(`${d.date}T00:00:00`).getDay();
            const isToday = d.date === todayKey;
            return (
              <div
                key={d.date}
                className={cn("rounded-xl border bg-card p-3", isToday && "border-primary/40")}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className={cn("text-sm font-medium", isToday && "text-primary")}>
                    {WEEKDAY_LABELS_LONG[dayOfWeek]}
                    {isToday && " (hoje)"}
                  </div>
                  <div className="text-xs text-muted-foreground">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {FIELDS.map((f) => (
                    <Dot key={f.key} d={d} field={f.key} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop/tablet: tabela. */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[480px] border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="w-40 text-left text-xs font-medium text-muted-foreground"></th>
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
              {FIELDS.map((f) => (
                <tr key={f.key}>
                  <td className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
                    <f.icon className="size-3.5" /> {f.label}
                  </td>
                  {(days ?? []).map((d) => (
                    <td key={d.date} className="text-center">
                      <div className="mx-auto flex w-fit">
                        <Dot d={d} field={f.key} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Dias de igreja com contorno mais forte são os planejados — marcar qualquer outro dia também conta, sem
          bloqueio nenhum.
        </p>
      </div>
    </div>
  );
}
