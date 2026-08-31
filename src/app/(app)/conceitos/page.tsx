"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpenText } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConceptEntry = {
  id: string;
  term: string;
  definition: string;
  noteId: string;
  noteTitle: string;
  tags: string[];
};

const NO_TAG = "Sem tag";
const ALL = "__all__";

/**
 * Glossário: todo termo marcado com ":Termo::Definição" em qualquer nota.
 * Sem filtro, agrupado pelas tags da nota de origem (uma nota com várias
 * tags aparece em cada grupo correspondente; sem tag nenhuma cai em "Sem
 * tag"). Com uma tag escolhida no filtro, vira lista simples só do que
 * tem aquela tag. Cada entrada também vira um flashcard "O que é Termo?"
 * sozinha (ver src/lib/flashcards.ts) — aqui é só a vista de
 * consulta/navegação, não de revisão.
 */
export default function ConceitosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightTerm = searchParams.get("termo");
  const { data: entries, isLoading } = useSWR<ConceptEntry[]>("/api/concepts", fetcher);
  const highlightedRef = useRef<HTMLDivElement>(null);
  const [tagFilter, setTagFilter] = useState(ALL);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries ?? []) for (const t of entry.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [entries]);

  const filtered = useMemo(
    () => (tagFilter === ALL ? (entries ?? []) : (entries ?? []).filter((e) => e.tags.includes(tagFilter))),
    [entries, tagFilter]
  );

  const groups = useMemo(() => {
    if (tagFilter !== ALL) return [[tagFilter, filtered] as const];

    const byTag = new Map<string, ConceptEntry[]>();
    for (const entry of filtered) {
      const tags = entry.tags.length > 0 ? entry.tags : [NO_TAG];
      for (const tag of tags) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push(entry);
      }
    }
    return Array.from(byTag.entries()).sort(([a], [b]) => {
      if (a === NO_TAG) return 1;
      if (b === NO_TAG) return -1;
      return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
    });
  }, [filtered, tagFilter]);

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
        <p className="mb-4 text-sm text-muted-foreground">
          Todo termo marcado com <code className="rounded bg-muted px-1 py-0.5">:Termo::Definição</code> em
          qualquer nota, agrupado (ou filtrado) pela tag da nota onde está.
        </p>

        {allTags.length > 0 && (
          <div className="mb-6">
            <Select value={tagFilter} onValueChange={(v) => setTagFilter(v ?? ALL)}>
              <SelectTrigger size="sm" className="h-8 w-fit">
                <SelectValue>{(v: string) => (v === ALL ? "Todas as tags" : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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

        {!isLoading && (entries ?? []).length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <BookOpenText className="size-8" />
            <p>Nenhum conceito com essa tag.</p>
          </div>
        )}

        <div className="space-y-6">
          {groups.map(([tag, group]) => (
            <section key={tag}>
              {tagFilter === ALL && (
                <div className="mb-2 flex items-center gap-2">
                  {tag === NO_TAG ? (
                    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">{NO_TAG}</h2>
                  ) : (
                    <Badge variant="secondary" className="text-[11px]">
                      {tag}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{group.length}</span>
                </div>
              )}
              <div className="space-y-1.5">
                {group.map((entry) => {
                  const isHighlighted = highlightTerm?.toLowerCase() === entry.term.toLowerCase();
                  return (
                    <div
                      key={`${tag}:${entry.id}`}
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
