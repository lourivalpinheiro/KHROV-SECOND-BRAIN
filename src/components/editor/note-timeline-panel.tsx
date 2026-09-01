"use client";

import { useState } from "react";
import { generateHTML, type Extensions } from "@tiptap/core";
import { ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTE_TYPE_META } from "@/lib/note-types";
import type { NoteStageHistoryDTO } from "@/types/models";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function renderSnapshot(content: unknown, extensions: Extensions): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return generateHTML(content as any, extensions);
  } catch {
    // Snapshot antigo/corrompido não pode derrubar a página da nota.
    return "<p><em>Não foi possível renderizar este snapshot.</em></p>";
  }
}

/**
 * Linha do tempo da nota — uma "foto" do content pra cada estágio que ela
 * já deixou pra trás (ver model NoteStageHistory e o hook em
 * PATCH /api/notes/[id]). Regressão nunca entra aqui, só promoção pra
 * frente — por isso a ordem cronológica (createdAt asc, já vem assim da
 * API) já bate com a ordem do pipeline: Estímulo → Potenciação → Sinapse.
 * Mobile-first: o ponto de entrada de verdade é o botão flutuante (visível
 * sempre); a trilha com bolinhas ao lado da nota (mesmo padrão do NoteToc,
 * fixed + hidden abaixo de xl) é só um atalho extra pra quem tem tela
 * larga sobrando. Clicar num estágio abre o snapshot em tela cheia, no
 * mesmo layout de leitura da nota de verdade — é a MESMA nota num momento
 * anterior, não um popup de dados à parte.
 */
export function NoteTimelinePanel({
  entries,
  extensions,
  noteTitle,
}: {
  entries: NoteStageHistoryDTO[];
  extensions: Extensions;
  /** Mesma nota, mesmo título sempre — só o content muda de foto pra foto. Mostrado no modal pra reforçar que é a MESMA nota num momento anterior, não uma nota separada. */
  noteTitle: string;
}) {
  const [selected, setSelected] = useState<NoteStageHistoryDTO | null>(null);
  // Colapsado por padrão — mesmo princípio do Sumário e de Conexões feitas:
  // é informação de consulta, não algo que precisa ocupar espaço toda vez
  // que a nota abre.
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <>
      {/* Mobile/tablet: a trilha flutuante (abaixo) só cabe a partir de xl —
          sem isso a linha do tempo simplesmente não existiria em telas
          menores. Botão flutuante padrão (canto inferior, alcance do
          polegar) abre a mesma lista de estágios num menu. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Linha do tempo da nota"
              className="fixed right-4 bottom-4 z-20 flex size-11 items-center justify-center rounded-full border bg-card text-foreground shadow-lg xl:hidden"
            />
          }
        >
          <History className="size-4.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {entries.map((entry) => {
            const meta = NOTE_TYPE_META[entry.stage];
            const Icon = meta.icon;
            return (
              <DropdownMenuItem key={entry.id} onClick={() => setSelected(entry)}>
                <Icon /> {meta.label}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                  {entry.isEstimate && " · estimativa"}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <nav
        aria-label="Linha do tempo da nota"
        className="fixed top-24 left-[calc(var(--sidebar-width,16rem)+1rem)] z-20 hidden max-h-[65vh] w-56 overflow-y-auto rounded-lg border bg-card/95 p-3 text-xs shadow-sm backdrop-blur xl:block"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 px-1 py-0.5 text-muted-foreground hover:text-foreground"
        >
          <History className="size-3.5" />
          <span className="font-medium">Linha do tempo</span>
          <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <ol className="relative mt-2.5 space-y-3 border-l border-border pl-4">
            {entries.map((entry) => {
              const meta = NOTE_TYPE_META[entry.stage];
              const Icon = meta.icon;
              return (
                <li key={entry.id} className="relative">
                  <span className="absolute top-1 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
                  {/* Duas linhas em vez de uma linha só espremendo ícone + rótulo +
                      "(estimativa)" + data — na largura estreita da trilha isso
                      truncava tudo de forma ilegível. */}
                  <button
                    type="button"
                    onClick={() => setSelected(entry)}
                    className="block w-full text-left"
                  >
                    <span className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{meta.label}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                      {entry.isEstimate && " · estimativa"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </nav>

      {/* Abre em tela cheia, no mesmo layout de leitura da nota de verdade (ver
          o bloco readingMode em note-editor.tsx) — é a MESMA nota num momento
          anterior, então deve se ler como uma nota normal, não como um popup
          de dados. Continua sendo o Dialog do Base UI por baixo (Esc fecha,
          foco preso, backdrop) — só o visual é sobrescrito pra ocupar a tela
          inteira. */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="top-0 left-0 h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-background p-0 ring-0">
          {selected && (
            <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
              <DialogHeader className="mb-6 gap-3">
                <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {noteTitle || "Nota sem título"}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {(() => {
                    const Icon = NOTE_TYPE_META[selected.stage].icon;
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                        <Icon className="size-3.5" />
                        {NOTE_TYPE_META[selected.stage].label} — como estava em{" "}
                        {new Date(selected.createdAt).toLocaleDateString("pt-BR")}
                        {selected.isEstimate && " (estimativa — reconstruída, não é o conteúdo real da época)"}
                      </span>
                    );
                  })()}
                </div>
              </DialogHeader>
              <div
                className="prose prose-neutral dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderSnapshot(selected.content, extensions) }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
