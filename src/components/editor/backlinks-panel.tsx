"use client";

import useSWR from "swr";
import Link from "next/link";
import { Link2 } from "lucide-react";
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

  // Uma nota pode aparecer nos dois sentidos (ex: A referencia B e B também
  // referencia A) — combina tudo numa lista só, sem repetir.
  const combined = new Map<string, Backlink>();
  for (const n of [...(data?.outgoing ?? []), ...(data?.incoming ?? [])]) combined.set(n.id, n);
  const notes = Array.from(combined.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (notes.length === 0) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Link2 className="size-3.5" /> Conexões feitas ({notes.length})
      </h3>
      <NoteList notes={notes} />
    </div>
  );
}
