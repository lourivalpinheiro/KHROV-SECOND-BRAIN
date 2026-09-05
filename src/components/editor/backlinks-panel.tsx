"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, ChevronDown, Link2 } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type LinkContextSegment = { text: string; isLink?: boolean };
type LinkContext = { segments: LinkContextSegment[] };
type Backlink = { id: string; title: string; updatedAt: string };
type IncomingBacklink = Backlink & { contexts: LinkContext[] };
type BacklinksResponse = { incoming: IncomingBacklink[]; outgoing: Backlink[] };

function NoteList({ notes }: { notes: Backlink[] }) {
  return (
    <ul className="space-y-1">
      {notes.map((n) => (
        <li key={n.id}>
          <Link
            href={`/notes/${n.id}`}
            className="block truncate rounded-md border bg-card px-2.5 py-1.5 text-sm hover:border-primary/40 hover:bg-accent/40"
          >
            {n.title || "Nota sem título"}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Um trecho de contexto: o parágrafo/título inteiro de onde a nota atual foi mencionada, com o próprio link destacado — não só o título da nota de origem. */
function ContextExcerpt({ context }: { context: LinkContext }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {context.segments.map((seg, i) =>
        seg.isLink ? (
          <span key={i} className="font-medium text-primary">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

function IncomingList({ notes }: { notes: IncomingBacklink[] }) {
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n.id} className="rounded-md border bg-card p-2.5">
          <Link
            href={`/notes/${n.id}`}
            className="mb-1.5 block truncate text-sm font-medium hover:text-primary"
          >
            {n.title || "Nota sem título"}
          </Link>
          {n.contexts.length > 0 ? (
            <ul className="space-y-1 border-l-2 pl-2.5">
              {n.contexts.map((ctx, i) => (
                <li key={i}>
                  <ContextExcerpt context={ctx} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground/70">(sem trecho de texto pra mostrar)</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function BacklinksPanel({ noteId }: { noteId: string }) {
  const { data } = useSWR<BacklinksResponse>(`/api/notes/${noteId}/backlinks`, fetcher);
  const outgoing = data?.outgoing ?? [];
  const incoming = data?.incoming ?? [];
  // Colapsado por padrão — é informação de consulta, não algo que precisa
  // saltar aos olhos toda vez que a nota abre. Quem quiser, expande.
  const [open, setOpen] = useState(false);

  // Uma nota pode criar conexões E, ao mesmo tempo, ser produto de uma
  // conexão anterior — as duas listas são independentes, a mesma nota pode
  // aparecer nas duas (não junta/deduplica).
  if (outgoing.length === 0 && incoming.length === 0) return null;

  const total = outgoing.length + incoming.length;

  return (
    <div className="border-t pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Link2 className="size-3.5" /> Conexões feitas
        <span className="text-xs font-normal">({total})</span>
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {outgoing.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowUpRight className="size-3.5" /> Conexões que esta nota criou ({outgoing.length})
              </p>
              <NoteList notes={outgoing} />
            </div>
          )}

          {incoming.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDownLeft className="size-3.5" /> Esta nota veio de uma conexão em ({incoming.length})
              </p>
              <IncomingList notes={incoming} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
