"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { BookmarkCheck, CalendarClock, Check, Meh, Plus, Trash2, X } from "lucide-react";
import { fetcher, postJSON, deleteJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { isDue, type ReviewGrade } from "@/lib/spaced-repetition";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MemoryVerse = {
  id: string;
  reference: string;
  text: string | null;
  status: "LEARNING" | "MEMORIZED";
  dueAt: string;
  repetitions: number;
};

/**
 * Versículos pra memorizar com repetição espaçada de verdade (mesmo motor
 * dos flashcards do Conhecimento) — modo lista pra cadastrar/gerenciar, e
 * "Praticar" que vira um deck só com o que está devido: mostra a
 * referência, clica pra revelar o texto, avalia Errei/Difícil/Fácil e a
 * próxima revisão é agendada sozinha.
 */
export default function VersiculosPage() {
  const { data: verses, isLoading } = useSWR<MemoryVerse[]>("/api/spiritual/memory-verses", fetcher);
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [practicing, setPracticing] = useState(false);

  async function create() {
    if (!reference.trim()) return toast.error("Escreva a referência (ex: João 3:16).");
    setCreating(true);
    try {
      await postJSON("/api/spiritual/memory-verses", { reference: reference.trim(), text: text.trim() || null });
      setReference("");
      setText("");
      await mutate("/api/spiritual/memory-verses");
      toast.success("Versículo adicionado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteJSON(`/api/spiritual/memory-verses/${id}`);
      await mutate("/api/spiritual/memory-verses");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  const dueVerses = useMemo(() => (verses ?? []).filter((v) => isDue(v.dueAt)), [verses]);

  if (practicing) {
    return <PracticeDeck verses={dueVerses} onExit={() => setPracticing(false)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Versículos</h1>
          </div>
          {dueVerses.length > 0 && (
            <Button size="sm" onClick={() => setPracticing(true)}>
              <CalendarClock className="size-4" /> Praticar ({dueVerses.length})
            </Button>
          )}
        </div>

        <div className="mb-6 space-y-2 rounded-xl border bg-card p-3">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referência — ex: João 3:16" />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Texto do versículo (opcional, mas ajuda a praticar)" rows={2} />
          <Button size="sm" onClick={create} disabled={creating}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : (verses ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum versículo ainda — comece com um que você quer guardar de cor.
          </p>
        ) : (
          <div className="space-y-2">
            {(verses ?? []).map((v) => (
              <div key={v.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{v.reference}</span>
                    {v.status === "MEMORIZED" && (
                      <span className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Memorizado
                      </span>
                    )}
                    {isDue(v.dueAt) && v.repetitions > 0 && (
                      <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Pra revisar</span>
                    )}
                  </div>
                  {v.text && <p className="mt-0.5 text-xs text-muted-foreground">{v.text}</p>}
                </div>
                <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive hover:text-destructive" onClick={() => remove(v.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PracticeDeck({ verses, onExit }: { verses: MemoryVerse[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const current = verses[index];

  async function grade(g: ReviewGrade) {
    if (!current) return;
    try {
      await postJSON("/api/spiritual/memory-verses/review", { id: current.id, grade: g });
      await mutate("/api/spiritual/memory-verses");
    } catch {
      toast.error("Erro ao registrar a revisão.");
    }
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <BookmarkCheck className="size-8 text-primary" />
        <p className="text-sm text-muted-foreground">Terminou a prática de hoje — {verses.length > 0 ? "" : "nada pendente."}</p>
        <Button onClick={onExit}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X className="size-4" /> Sair
        </Button>
        <span className="text-sm text-muted-foreground">
          {index + 1} / {verses.length}
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setRevealed((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setRevealed((v) => !v)}
        className="flex min-h-72 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border bg-card p-8 text-center shadow-xs transition-colors hover:border-primary/40"
      >
        <p className="text-lg font-medium text-primary">{current.reference}</p>
        {revealed ? (
          current.text ? (
            <p className="text-base leading-relaxed">{current.text}</p>
          ) : (
            <p className="text-sm text-muted-foreground">(sem texto salvo — recite de cor e avalie como foi)</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Toque pra revelar</p>
        )}
      </div>

      {revealed && (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => grade("AGAIN")}>
            <X className="size-4" /> Errei
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => grade("HARD")}>
            <Meh className="size-4" /> Difícil
          </Button>
          <Button variant="outline" className={cn("gap-1.5 border-primary/40 text-primary hover:bg-primary/10")} onClick={() => grade("EASY")}>
            <Check className="size-4" /> Fácil
          </Button>
        </div>
      )}
    </div>
  );
}
