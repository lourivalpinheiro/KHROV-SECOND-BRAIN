"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toLocalDateKey, WEEKDAY_LABELS_LONG } from "@/lib/health";
import { toast } from "sonner";

type DayRecord = { date: string; waterBottles: number; gym: boolean; notes: string };

function formatHeading(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_LABELS_LONG[date.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function addDays(dateKey: string, delta: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return toLocalDateKey(date);
}

/**
 * Caderno de treino — um dia de cada vez, pra anotar observações da
 * sessão (o "Córtex" da Saúde: captura crua e rápida, sem estrutura).
 * Autosave com debounce, igual o editor de notas.
 */
export default function CadernoSaudePage() {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));
  const { data: days } = useSWR<DayRecord[]>(`/api/health/days?date=${dateKey}`, fetcher);
  const day = days?.find((d) => d.date === dateKey);

  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const loadedFor = useRef<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!day || loadedFor.current === dateKey) return;
    loadedFor.current = dateKey;
    setNotes(day.notes);
    setSaveState("idle");
  }, [day, dateKey]);

  function onChange(value: string) {
    setNotes(value);
    setSaveState("saving");
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(async () => {
      try {
        await patchJSON("/api/health/days", { date: dateKey, notes: value });
        await mutate(`/api/health/days?date=${dateKey}`);
        setSaveState("saved");
      } catch {
        setSaveState("idle");
        toast.error("Erro ao salvar as observações.");
      }
    }, 600);
  }

  const isToday = dateKey === toLocalDateKey(new Date());

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <NotebookPen className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Caderno de treino</h1>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setDateKey((k) => addDays(k, -1))}>
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
              onClick={() => setDateKey((k) => addDays(k, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : ""}
          </span>
        </div>

        <Textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Como foi o treino hoje? Cargas, sensações, o que ajustar da próxima vez..."
          rows={14}
          className="resize-none"
        />
      </div>
    </div>
  );
}
