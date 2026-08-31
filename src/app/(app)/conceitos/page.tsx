"use client";

import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpenText } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

type ConceptEntry = {
  id: string;
  term: string;
  definition: string;
  noteId: string;
  noteTitle: string;
};

/**
 * Glossário: todo termo marcado com ":Termo::Definição" em qualquer nota,
 * em ordem alfabética. Cada entrada também vira um flashcard "O que é
 * Termo?" sozinha (ver src/lib/flashcards.ts) — aqui é só a vista de
 * consulta/navegação, não de revisão.
 */
export default function ConceitosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightTerm = searchParams.get("termo");
  const { data: entries, isLoading } = useSWR<ConceptEntry[]>("/api/concepts", fetcher);
  const highlightedRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const byLetter = new Map<string, ConceptEntry[]>();
    for (const entry of entries ?? []) {
      const letter = entry.term[0]?.toUpperCase() ?? "#";
      if (!byLetter.has(letter)) byLetter.set(letter, []);
      byLetter.get(letter)!.push(entry);
    }
    return Array.from(byLetter.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [entries]);

  useEffect(() => {
    if (highlightTerm && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlightTerm, entries]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-2 flex items-center gap-2">
          <BookOpenText className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Conceitos</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Todo termo marcado com <code className="rounded bg-muted px-1 py-0.5">:Termo::Definição</code> em
          qualquer nota, num lugar só.
        </p>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && (entries ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <BookOpenText className="size-8" />
            <p>
              Nenhum conceito ainda. Escreva <code className="rounded bg-muted px-1 py-0.5">:Termo::Definição</code>{" "}
              em qualquer nota.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {groups.map(([letter, group]) => (
            <section key={letter}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">{letter}</h2>
              <div className="space-y-1.5">
                {group.map((entry) => {
                  const isHighlighted = highlightTerm?.toLowerCase() === entry.term.toLowerCase();
                  return (
                    <div
                      key={entry.id}
                      ref={isHighlighted ? highlightedRef : undefined}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/notes/${entry.noteId}`)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(`/notes/${entry.noteId}`)}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40 ${
                        isHighlighted ? "border-primary/50 bg-accent/30" : "bg-card"
                      }`}
                    >
                      <h3 className="font-medium">{entry.term}</h3>
                      {entry.definition && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{entry.definition}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/70">Em: {entry.noteTitle}</p>
                    </div>
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
