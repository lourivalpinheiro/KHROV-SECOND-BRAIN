"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import type { NoteListItem } from "@/types/models";
import { Skeleton } from "@/components/ui/skeleton";
import { NOTE_TYPE_META } from "@/lib/note-types";

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeading(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const formatted = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Todas as notas em ordem cronológica de criação, agrupadas por dia — o
 * eixo do tempo do pipeline, complementar aos agrupamentos por estágio
 * (/notes) e por conexão (/graph).
 */
export default function TimelinePage() {
  const router = useRouter();
  const { data: notes, isLoading } = useSWR<NoteListItem[]>("/api/notes", fetcher);

  const groups = useMemo(() => {
    if (!notes) return [];
    const sorted = [...notes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const byDay = new Map<string, NoteListItem[]>();
    for (const note of sorted) {
      const key = dayKey(note.createdAt);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(note);
    }
    return Array.from(byDay.entries());
  }, [notes]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <History className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Linha do tempo</h1>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <History className="size-8" />
            <p>Nenhuma nota ainda.</p>
          </div>
        )}

        <div className="relative space-y-8 pl-5">
          <div className="absolute top-1 bottom-1 left-[7px] w-px bg-border" aria-hidden />
          {groups.map(([key, dayNotes]) => (
            <section key={key} className="relative">
              <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground">
                {formatDayHeading(key)}
              </h2>
              <div className="space-y-2">
                {dayNotes.map((note) => {
                  const meta = NOTE_TYPE_META[note.type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => router.push(`/notes/${note.id}`)}
                      className="group relative flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <span
                        className="absolute top-4 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary"
                        aria-hidden
                      />
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="line-clamp-1 text-sm font-medium">
                            {note.title || "Nota sem título"}
                          </h3>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatTime(note.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{meta.label}</p>
                        {note.plainText && (
                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{note.plainText}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
