"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Moon } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { minutesToTimeLabel, sleepChartValue, toLocalDateKey, WEEKDAY_LABELS_LONG } from "@/lib/health";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type HealthProfile = { weightKg: number; heightCm: number; targetBedtimeMinutes: number | null } | null;
type SleepEntry = { date: string; bedtimeMinutes: number };

const chartConfig = {
  target: { label: "Meta", color: "var(--muted-foreground)" },
  real: { label: "Real", color: "var(--primary)" },
} satisfies ChartConfig;

function addDays(dateKey: string, delta: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return toLocalDateKey(date);
}

function formatHeading(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_LABELS_LONG[date.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/**
 * Controle de sono: uma hora-alvo de dormir (fica no perfil), um registro
 * por noite da hora que de fato foi dormir, e um gráfico comparando os
 * dois — horários de madrugada "continuam" a escala da noite anterior em
 * vez de voltar pro início (ver sleepChartValue em src/lib/health.ts).
 */
export default function SonoSaudePage() {
  const { data: profile, isLoading: loadingProfile } = useSWR<HealthProfile>("/api/health/profile", fetcher);
  const [targetTime, setTargetTime] = useState("23:00");
  const targetLoaded = useRef(false);
  const [savingTarget, setSavingTarget] = useState(false);

  useEffect(() => {
    if (!profile || targetLoaded.current) return;
    targetLoaded.current = true;
    setTargetTime(profile.targetBedtimeMinutes != null ? minutesToTimeLabel(profile.targetBedtimeMinutes) : "23:00");
  }, [profile]);

  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));
  const [logTime, setLogTime] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  const rangeFrom = useMemo(() => addDays(toLocalDateKey(new Date()), -30), []);
  const rangeTo = toLocalDateKey(new Date());
  const { data: sleepDays, isLoading: loadingSleep } = useSWR<SleepEntry[]>(
    `/api/health/sleep?from=${rangeFrom}&to=${rangeTo}`,
    fetcher
  );

  const todayEntry = sleepDays?.find((d) => d.date === dateKey);

  const chartData = useMemo(() => {
    if (!sleepDays || !profile?.targetBedtimeMinutes) return [];
    const targetValue = sleepChartValue(profile.targetBedtimeMinutes);
    return sleepDays.map((d) => ({
      date: d.date,
      target: targetValue,
      real: sleepChartValue(d.bedtimeMinutes),
    }));
  }, [sleepDays, profile]);

  async function saveTarget() {
    if (!profile) return;
    setSavingTarget(true);
    try {
      await patchJSON("/api/health/profile", {
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        targetBedtimeMinutes: targetTime,
      });
      await mutate("/api/health/profile");
      toast.success("Meta de sono salva.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar meta.");
    } finally {
      setSavingTarget(false);
    }
  }

  async function saveLog() {
    if (!logTime) {
      toast.error("Escolha um horário.");
      return;
    }
    setSavingLog(true);
    try {
      await patchJSON("/api/health/sleep", { date: dateKey, time: logTime });
      await mutate(`/api/health/sleep?from=${rangeFrom}&to=${rangeTo}`);
      toast.success("Registrado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar.");
    } finally {
      setSavingLog(false);
    }
  }

  const isToday = dateKey === toLocalDateKey(new Date());

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Moon className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sono</h1>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Hora-alvo de dormir</h2>
          {loadingProfile ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Meta</Label>
                <Input type="time" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} className="w-32" />
              </div>
              <Button size="sm" onClick={saveTarget} disabled={savingTarget}>
                Salvar
              </Button>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Registrar a noite</h2>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => {
                  setDateKey((k) => addDays(k, -1));
                  setLogTime("");
                }}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-40 text-center text-sm font-medium">
                {formatHeading(dateKey)}
                {isToday && <span className="ml-1.5 text-xs text-primary">(hoje)</span>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={isToday}
                onClick={() => {
                  setDateKey((k) => addDays(k, 1));
                  setLogTime("");
                }}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Que horas foi dormir</Label>
              <Input
                type="time"
                value={logTime || (todayEntry ? minutesToTimeLabel(todayEntry.bedtimeMinutes) : "")}
                onChange={(e) => setLogTime(e.target.value)}
                className="w-32"
              />
            </div>
            <Button size="sm" onClick={saveLog} disabled={savingLog}>
              Registrar
            </Button>
          </div>
          {todayEntry && (
            <p className="mt-2 text-xs text-muted-foreground">
              Já registrado: {minutesToTimeLabel(todayEntry.bedtimeMinutes)}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Meta × real (últimos 30 dias)</h2>
          {loadingSleep ? (
            <Skeleton className="h-56 w-full" />
          ) : !profile?.targetBedtimeMinutes ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Defina uma meta acima pra ver a comparação.</p>
          ) : chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro ainda nos últimos 30 dias.</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
              <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={["dataMin - 30", "dataMax + 30"]}
                  tickFormatter={(v: number) => minutesToTimeLabel(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => `${String(v).slice(8, 10)}/${String(v).slice(5, 7)}/${String(v).slice(0, 4)}`}
                      formatter={(value, name) => [` ${minutesToTimeLabel(Number(value))}`, name === "target" ? "Meta" : "Real"]}
                    />
                  }
                />
                <Line dataKey="target" type="monotone" stroke="var(--color-target)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                <Line dataKey="real" type="monotone" stroke="var(--color-real)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          )}
          <p className={cn("mt-2 text-xs text-muted-foreground")}>
            Horários de madrugada continuam a escala da noite anterior (ex: 00:30 aparece logo depois de 23:00), pra
            não quebrar a linha.
          </p>
        </div>
      </div>
    </div>
  );
}
