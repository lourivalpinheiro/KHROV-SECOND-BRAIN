"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers, Shuffle, X, Meh, Check, CalendarClock } from "lucide-react";
import { fetcher, postJSON } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { isDue, type ReviewGrade } from "@/lib/spaced-repetition";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type FlashcardDTO = {
  id: string;
  noteId: string;
  cardKey: string;
  noteTitle: string;
  question: string;
  answers: string[];
  tags: { id: string; name: string }[];
  dueAt: string | null;
  repetitions: number;
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
  const searchParams = useSearchParams();
  // Veio de "N flashcards nesta nota" no editor: já chega filtrado pra essa
  // nota, e sem o filtro "só devidas" — a intenção ali é estudar/revisar as
  // desta nota agora, não esperar a data de repetição espaçada.
  const initialNoteId = searchParams.get("noteId");
  const [noteFilter, setNoteFilter] = useState(initialNoteId ?? ALL);
  const [tagFilter, setTagFilter] = useState(ALL);
  const [dueOnly, setDueOnly] = useState(!initialNoteId);
  const [order, setOrder] = useState<FlashcardDTO[] | null>(null);
  const [index, setIndex] = useState(0);
  // Quantas respostas já foram reveladas do card atual — em cards de resposta
  // única funciona como um boolean (0 ou 1); em cards com várias respostas,
  // cada clique revela mais uma, na ordem.
  const [revealedCount, setRevealedCount] = useState(0);

  const notesWithCards = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCards ?? []) map.set(c.noteId, c.noteTitle);
    return Array.from(map, ([id, title]) => ({ id, title }));
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
        (tagFilter === ALL || c.tags.some((t) => t.id === tagFilter))
    );
  }, [allCards, noteFilter, tagFilter]);

  const dueFiltered = useMemo(() => filtered.filter((c) => isDue(c.dueAt)), [filtered]);
  const baseDeck = dueOnly ? dueFiltered : filtered;
  const deck = order ?? baseDeck;
  const current = deck[index];
  const isRevealed = !!current && revealedCount >= current.answers.length;

  function resetDeck() {
    setOrder(null);
    setIndex(0);
    setRevealedCount(0);
  }

  function shuffleDeck() {
    setOrder(shuffle(baseDeck));
    setIndex(0);
    setRevealedCount(0);
  }

  function go(delta: number) {
    setRevealedCount(0);
    setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length - 1));
  }

  function revealNext() {
    const total = current?.answers.length ?? 0;
    // Depois de revelar tudo, o próximo clique recomeça (esconde de novo).
    setRevealedCount((c) => (c >= total ? 0 : c + 1));
  }

  async function grade(g: ReviewGrade) {
    if (!current) return;
    try {
      await postJSON("/api/flashcards/review", { noteId: current.noteId, cardKey: current.cardKey, grade: g });
      await mutate("/api/flashcards");
    } catch {
      toast.error("Erro ao registrar a revisão.");
    }
    go(1);
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

        <Toggle
          size="sm"
          className="h-8 gap-1.5 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          pressed={dueOnly}
          onPressedChange={(v) => {
            setDueOnly(v);
            resetDeck();
          }}
        >
          <CalendarClock className="size-3.5" /> Só devidas ({dueFiltered.length})
        </Toggle>

        <span className="ml-auto text-sm text-muted-foreground">
          {deck.length > 0 ? `${index + 1} / ${deck.length}` : "0 / 0"}
        </span>
      </div>

      {current ? (
        <div
          role="button"
          tabIndex={0}
          onClick={revealNext}
          onKeyDown={(e) => e.key === "Enter" && revealNext()}
          className="flex min-h-72 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border bg-card p-8 text-center shadow-xs transition-colors hover:border-primary/40"
        >
          <span className="text-xs text-muted-foreground">{current.noteTitle}</span>
          <p className="text-lg font-medium">{current.question}</p>

          {current.answers.length > 1 ? (
            <ul className="w-full max-w-sm space-y-1.5">
              {current.answers.map((a, i) => {
                const isRevealed = i < revealedCount;
                return (
                  <li
                    key={i}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      isRevealed
                        ? "border-transparent bg-muted text-foreground"
                        : "border-dashed text-muted-foreground/40"
                    )}
                  >
                    {isRevealed ? a : "· · ·"}
                  </li>
                );
              })}
            </ul>
          ) : revealedCount > 0 ? (
            <p className="text-muted-foreground">{current.answers[0]}</p>
          ) : null}

          <span className="text-xs text-muted-foreground">
            {current.answers.length > 1
              ? revealedCount === 0
                ? `Clique para revelar a 1ª resposta (${current.answers.length} no total)`
                : revealedCount < current.answers.length
                  ? `Clique para revelar a próxima (${revealedCount}/${current.answers.length})`
                  : "Clique para esconder e recomeçar"
              : revealedCount === 0
                ? "Clique para revelar a resposta"
                : "Clique para esconder"}
          </span>

          <Link
            href={`/notes/${current.noteId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline"
          >
            Abrir nota
          </Link>
        </div>
      ) : dueOnly && filtered.length > 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <Check className="size-8 text-primary" />
          <p>Tudo revisado por aqui! Nenhum flashcard devido agora.</p>
          <Button variant="outline" size="sm" onClick={() => { setDueOnly(false); resetDeck(); }}>
            Ver todos os {filtered.length}
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          Nenhum flashcard para essa seleção.
        </div>
      )}

      {current && isRevealed && (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => grade("AGAIN")}>
            <X /> Errei
          </Button>
          <Button variant="outline" onClick={() => grade("HARD")}>
            <Meh /> Difícil
          </Button>
          <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => grade("EASY")}>
            <Check /> Fácil
          </Button>
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
