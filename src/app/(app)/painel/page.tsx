"use client";

import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Link2Off, RefreshCw, Sparkles } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import type { NoteListItem } from "@/types/models";
import { NOTE_TYPES, NOTE_TYPE_META } from "@/lib/note-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type OrphanNote = { id: string; title: string; type: keyof typeof NOTE_TYPE_META; plainText: string; updatedAt: string };
type RandomEngram = { id: string; title: string; plainText: string; updatedAt: string } | null;

const RANDOM_ENGRAM_KEY = "/api/notes/random-engram";

/**
 * Painel do Conhecimento — hub que reúne contagem por estágio, notas sem
 * nenhuma conexão e um Engrama pra resurgir de vez em quando. Não substitui
 * /notes (a lista continua sendo o lugar de trabalhar nota por nota); isto
 * aqui é só um resumo de saúde da base + um ponto de entrada pros dois.
 */
export default function PainelPage() {
  const router = useRouter();
  const { data: notes, isLoading: loadingNotes } = useSWR<NoteListItem[]>("/api/notes", fetcher);
  const { data: orphans, isLoading: loadingOrphans } = useSWR<OrphanNote[]>("/api/notes/orphans", fetcher);
  const { data: engram, isLoading: loadingEngram } = useSWR<RandomEngram>(RANDOM_ENGRAM_KEY, fetcher);

  const counts = new Map<string, number>();
  for (const n of notes ?? []) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Painel</h1>
        </div>

        {/* Contagem por estágio — Córtex fica de fora (não é estágio do pipeline). */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground">Pipeline</h2>
          {loadingNotes ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {NOTE_TYPES.map((type) => {
                const meta = NOTE_TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => router.push(`/notes?types=${type}`)}
                    className="flex flex-col items-start gap-1.5 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-2xl font-semibold tabular-nums">{counts.get(type) ?? 0}</span>
                    <span className="text-xs text-muted-foreground">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Engrama do dia — resurgir conhecimento já consolidado. */}
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-muted-foreground">
            <Sparkles className="size-3.5" /> Resurgir
          </h2>
          {loadingEngram ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : engram ? (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-medium">{engram.title || "Nota sem título"}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  title="Sortear outro"
                  onClick={() => mutate(RANDOM_ENGRAM_KEY)}
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>
              {engram.plainText && <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">{engram.plainText}</p>}
              <Button variant="outline" size="sm" onClick={() => router.push(`/notes/${engram.id}`)}>
                Reler
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum Engrama ainda — promova uma nota até o fim do pipeline pra ela aparecer aqui.
            </div>
          )}
        </section>

        {/* Notas órfãs — sem link nenhum, em qualquer estágio. */}
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-muted-foreground">
            <Link2Off className="size-3.5" /> Sem conexão
            {orphans && orphans.length > 0 && <span className="font-normal">({orphans.length})</span>}
          </h2>
          {loadingOrphans ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : !orphans || orphans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Toda nota tem pelo menos uma conexão. 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {orphans.slice(0, 8).map((n) => {
                const meta = NOTE_TYPE_META[n.type];
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => router.push(`/notes/${n.id}`)}
                    className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{n.title || "Nota sem título"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{meta.label}</span>
                  </button>
                );
              })}
              {orphans.length > 8 && (
                <p className="px-1 text-xs text-muted-foreground">+{orphans.length - 8} outra(s).</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
