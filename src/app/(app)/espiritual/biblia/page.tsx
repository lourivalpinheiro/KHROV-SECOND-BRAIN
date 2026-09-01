"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { BookMarked, ChevronDown, ChevronRight } from "lucide-react";
import { fetcher, postJSON } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { BIBLE_BOOKS, BIBLE_TOTAL_CHAPTERS } from "@/lib/bible";
import { cn } from "@/lib/utils";

type Progress = { book: string; chapter: number };

/**
 * Progresso de leitura bíblica: os 66 livros (fixo, ver src/lib/bible.ts),
 * cada um expansível numa grade de capítulos clicáveis pra marcar como
 * lido. A % geral é sobre o total de 1189 capítulos.
 */
export default function BibliaPage() {
  const { data: progress, isLoading } = useSWR<Progress[]>("/api/spiritual/bible-progress", fetcher);
  const [expanded, setExpanded] = useState<string | null>(null);

  const readByBook = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const p of progress ?? []) {
      const set = map.get(p.book) ?? new Set<number>();
      set.add(p.chapter);
      map.set(p.book, set);
    }
    return map;
  }, [progress]);

  const totalRead = progress?.length ?? 0;
  const overallPct = BIBLE_TOTAL_CHAPTERS > 0 ? (totalRead / BIBLE_TOTAL_CHAPTERS) * 100 : 0;

  async function toggleChapter(book: string, chapter: number) {
    const set = readByBook.get(book) ?? new Set<number>();
    const wasRead = set.has(chapter);
    const nextSet = new Set(set);
    if (wasRead) nextSet.delete(chapter);
    else nextSet.add(chapter);
    const optimistic = wasRead
      ? (progress ?? []).filter((p) => !(p.book === book && p.chapter === chapter))
      : [...(progress ?? []), { book, chapter }];
    mutate("/api/spiritual/bible-progress", optimistic, { revalidate: false });
    try {
      await postJSON("/api/spiritual/bible-progress", { book, chapter });
      await mutate("/api/spiritual/bible-progress");
    } catch {
      await mutate("/api/spiritual/bible-progress");
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2">
          <BookMarked className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Bíblia</h1>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium">Progresso geral</span>
            <span className="text-sm text-muted-foreground">
              {totalRead}/{BIBLE_TOTAL_CHAPTERS} capítulos ({overallPct.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        <div className="space-y-1.5">
          {BIBLE_BOOKS.map((book) => {
            const readSet = readByBook.get(book.name) ?? new Set<number>();
            const pct = (readSet.size / book.chapters) * 100;
            const isOpen = expanded === book.name;
            return (
              <div key={book.name} className="rounded-xl border bg-card">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : book.name)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isOpen ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="truncate text-sm font-medium">{book.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {readSet.size}/{book.chapters}
                    </span>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", pct === 100 ? "bg-primary" : "bg-primary/60")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-8 gap-1.5 border-t p-3 sm:grid-cols-10">
                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map((ch) => {
                      const read = readSet.has(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChapter(book.name, ch)}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                            read
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-dashed text-muted-foreground/60 hover:border-primary/40"
                          )}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
