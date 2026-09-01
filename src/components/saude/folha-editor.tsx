"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { ChevronLeft, ChevronRight, NotebookPen, Trash2 } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
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
 * Folha do caderno — um dia, pra anotar observações da sessão de treino.
 * Autosave com debounce, igual o editor de notas. "Excluir" só limpa o
 * texto (água/academia daquele dia são dados à parte, não somem junto).
 */
export function FolhaEditor({ date }: { date: string }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: days } = useSWR<DayRecord[]>(`/api/health/days?date=${date}`, fetcher);
  const day = days?.find((d) => d.date === date);

  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const loaded = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!day || loaded.current) return;
    loaded.current = true;
    setNotes(day.notes);
    setSaveState("idle");
  }, [day]);

  function onChange(value: string) {
    setNotes(value);
    setSaveState("saving");
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(async () => {
      try {
        await patchJSON("/api/health/days", { date, notes: value });
        await mutate(`/api/health/days?date=${date}`);
        await mutate("/api/health/notebook");
        setSaveState("saved");
      } catch {
        setSaveState("idle");
        toast.error("Erro ao salvar as observações.");
      }
    }, 600);
  }

  async function removeFolha() {
    const ok = await confirm({
      title: `Excluir a folha de ${formatHeading(date)}?`,
      description: "Só limpa as observações desse dia — água e academia marcadas continuam do jeito que estão.",
      confirmLabel: "Excluir folha",
      destructive: true,
    });
    if (!ok) return;
    try {
      await patchJSON("/api/health/days", { date, notes: "" });
      await mutate("/api/health/notebook");
      toast.success("Folha excluída.");
      router.push("/saude/caderno");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir a folha.");
    }
  }

  const isToday = date === toLocalDateKey(new Date());

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-5 text-muted-foreground" />
            <Link href="/saude/caderno" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Caderno
            </Link>
          </div>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={removeFolha}>
            <Trash2 /> Excluir folha
          </Button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => router.push(`/saude/caderno/${addDays(date, -1)}`)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-medium">
              {formatHeading(date)}
              {isToday && <span className="ml-1.5 text-xs text-primary">(hoje)</span>}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={isToday}
              onClick={() => router.push(`/saude/caderno/${addDays(date, 1)}`)}
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
      {ConfirmDialog}
    </div>
  );
}
