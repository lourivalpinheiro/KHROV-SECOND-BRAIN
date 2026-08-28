"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Layers, Shuffle } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FlashcardDTO = {
  id: string;
  noteId: string;
  noteTitle: string;
  question: string;
  answers: string[];
  folderId: string | null;
  folderName: string | null;
  tags: { id: string; name: string }[];
};

const ALL = "__all__";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardsView() {
  const { data: allCards, isLoading } = useSWR<FlashcardDTO[]>("/api/flashcards", fetcher);
  const [noteFilter, setNoteFilter] = useState(ALL);
  const [folderFilter, setFolderFilter] = useState(ALL);
  const [tagFilter, setTagFilter] = useState(ALL);
  const [order, setOrder] = useState<FlashcardDTO[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const notesWithCards = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCards ?? []) map.set(c.noteId, c.noteTitle);
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [allCards]);

  const foldersWithCards = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCards ?? []) if (c.folderId) map.set(c.folderId, c.folderName ?? "");
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allCards]);

  const tagsWithCards = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCards ?? []) for (const t of c.tags) map.set(t.id, t.name);
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allCards]);

  const filtered = useMemo(() => {
    return (allCards ?? []).filter(
      (c) =>
        (noteFilter === ALL || c.noteId === noteFilter) &&
        (folderFilter === ALL || c.folderId === folderFilter) &&
        (tagFilter === ALL || c.tags.some((t) => t.id === tagFilter))
    );
  }, [allCards, noteFilter, folderFilter, tagFilter]);

  const deck = order ?? filtered;
  const current = deck[index];

  function resetDeck() {
    setOrder(null);
    setIndex(0);
    setRevealed(false);
  }

  function shuffleDeck() {
    setOrder(shuffle(filtered));
    setIndex(0);
    setRevealed(false);
  }

  function go(delta: number) {
    setRevealed(false);
    setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length - 1));
  }

  if (isLoading) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Carregando flashcards...</div>;
  }

  if (!allCards || allCards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Layers className="size-8" />
        <p className="max-w-sm">
          Nenhum flashcard encontrado ainda. Crie um em qualquer nota escrevendo{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">Pergunta &gt;&gt; Resposta</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={noteFilter}
          onValueChange={(v) => {
            setNoteFilter(v ?? ALL);
            resetDeck();
          }}
        >
          <SelectTrigger size="sm" className="h-8">
            <SelectValue>
              {(v: string) =>
                v === ALL ? "Todas as notas" : notesWithCards.find((n) => n.id === v)?.title ?? "Todas as notas"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as notas</SelectItem>
            {notesWithCards.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {foldersWithCards.length > 0 && (
          <Select
            value={folderFilter}
            onValueChange={(v) => {
              setFolderFilter(v ?? ALL);
              resetDeck();
            }}
          >
            <SelectTrigger size="sm" className="h-8">
              <SelectValue>
                {(v: string) =>
                  v === ALL ? "Todas as pastas" : foldersWithCards.find((f) => f.id === v)?.name ?? "Todas as pastas"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as pastas</SelectItem>
              {foldersWithCards.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {tagsWithCards.length > 0 && (
          <Select
            value={tagFilter}
            onValueChange={(v) => {
              setTagFilter(v ?? ALL);
              resetDeck();
            }}
          >
            <SelectTrigger size="sm" className="h-8">
              <SelectValue>
                {(v: string) => (v === ALL ? "Todas as tags" : tagsWithCards.find((t) => t.id === v)?.name ?? "Todas as tags")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as tags</SelectItem>
              {tagsWithCards.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" className="h-8" onClick={shuffleDeck}>
          <Shuffle className="size-3.5" /> Embaralhar
        </Button>

        <span className="ml-auto text-sm text-muted-foreground">
          {deck.length > 0 ? `${index + 1} / ${deck.length}` : "0 / 0"}
        </span>
      </div>

      {current ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setRevealed((r) => !r)}
          onKeyDown={(e) => e.key === "Enter" && setRevealed((r) => !r)}
          className="flex min-h-72 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border bg-card p-8 text-center shadow-xs transition-colors hover:border-primary/40"
        >
          <span className="text-xs text-muted-foreground">{current.noteTitle}</span>
          <p className="text-lg font-medium">{current.question}</p>

          {revealed ? (
            current.answers.length > 1 ? (
              <ul className="space-y-1 text-muted-foreground">
                {current.answers.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{current.answers[0]}</p>
            )
          ) : (
            <span className="text-xs text-muted-foreground">Clique para revelar a resposta</span>
          )}

          <Link
            href={`/notes/${current.noteId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline"
          >
            Abrir nota
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Nenhum flashcard para essa seleção.
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => go(-1)} disabled={index === 0}>
          <ChevronLeft /> Anterior
        </Button>
        <Button variant="outline" onClick={() => go(1)} disabled={index >= deck.length - 1}>
          Próximo <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
