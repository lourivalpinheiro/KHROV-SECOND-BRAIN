"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { monthYearLabel, toLocalDateKey, WEEKDAY_LABELS_LONG } from "@/lib/health";
import { toast } from "sonner";

type NotebookEntry = { date: string; notes: string };

function firstLine(notes: string) {
  const line = notes.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

function formatDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_LABELS_LONG[date.getDay()].slice(0, 3)}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/**
 * Caderno de treino — cada dia com observações vira uma "folha"; folhas do
 * mesmo mês ficam agrupadas num "caderno". Lista simplificada, no estilo
 * das Notas: clique numa folha abre ela pra editar, ou exclui direto
 * daqui (só limpa as observações do dia — água/academia daquele dia
 * continuam intactas, são dados separados).
 */
export default function CadernoListPage() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: entries, isLoading } = useSWR<NotebookEntry[]>("/api/health/notebook", fetcher);
  const [newDate, setNewDate] = useState(() => toLocalDateKey(new Date()));

  const groups = useMemo(() => {
    const byMonth = new Map<string, NotebookEntry[]>();
    for (const e of entries ?? []) {
      const key = e.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(e);
    }
    return Array.from(byMonth.entries()); // já vem ordenado (API retorna desc, Map preserva ordem de inserção)
  }, [entries]);

  async function removeFolha(e: React.MouseEvent, entry: NotebookEntry) {
    e.stopPropagation();
    const ok = await confirm({
      title: `Excluir a folha de ${formatDay(entry.date)}?`,
      description: "Só limpa as observações desse dia — água e academia marcadas continuam do jeito que estão.",
      confirmLabel: "Excluir folha",
      destructive: true,
    });
    if (!ok) return;
    try {
      await patchJSON("/api/health/days", { date: entry.date, notes: "" });
      await mutate("/api/health/notebook");
      toast.success("Folha excluída.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir a folha.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <NotebookPen className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Caderno de treino</h1>
        </div>

        <div className="mb-6 flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="sm:w-44"
          />
          <Button className="sm:ml-auto" onClick={() => router.push(`/saude/caderno/${newDate}`)}>
            <Plus /> Abrir folha
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma folha ainda — escolha uma data acima e comece a escrever.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([monthKey, monthEntries]) => (
              <div key={monthKey}>
                <h2 className="mb-2 text-sm font-semibold tracking-tight text-muted-foreground">
                  {monthYearLabel(new Date(`${monthKey}-01T00:00:00`))}
                  <span className="ml-1.5 font-normal">
                    · {monthEntries.length} {monthEntries.length === 1 ? "folha" : "folhas"}
                  </span>
                </h2>
                <div className="space-y-1.5">
                  {monthEntries.map((entry) => (
                    <button
                      key={entry.date}
                      type="button"
                      onClick={() => router.push(`/saude/caderno/${entry.date}`)}
                      className="group flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40"
                    >
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatDay(entry.date)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{firstLine(entry.notes) || "(sem texto)"}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => removeFolha(e, entry)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") removeFolha(e as unknown as React.MouseEvent, entry);
                        }}
                        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        title="Excluir folha"
                      >
                        <Trash2 className="size-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
}
