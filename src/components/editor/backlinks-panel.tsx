"use client";

import useSWR from "swr";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, Link2 } from "lucide-react";
import { fetcher } from "@/lib/api-client";

type Backlink = { id: string; title: string; updatedAt: string };
type BacklinksResponse = { incoming: Backlink[]; outgoing: Backlink[] };

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

export function BacklinksPanel({ noteId }: { noteId: string }) {
  const { data } = useSWR<BacklinksResponse>(`/api/notes/${noteId}/backlinks`, fetcher);
  const outgoing = data?.outgoing ?? [];
  const incoming = data?.incoming ?? [];

  // Uma nota pode criar conexões E, ao mesmo tempo, ser produto de uma
  // conexão anterior — as duas listas são independentes, a mesma nota pode
  // aparecer nas duas (não junta/deduplica).
  if (outgoing.length === 0 && incoming.length === 0) return null;

  return (
    <div className="space-y-4 border-t pt-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Link2 className="size-3.5" /> Conexões feitas
      </h3>

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
          <NoteList notes={incoming} />
        </div>
      )}
    </div>
  );
}
