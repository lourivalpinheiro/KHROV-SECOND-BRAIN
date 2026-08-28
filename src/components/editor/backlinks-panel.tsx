"use client";

import useSWR from "swr";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { fetcher } from "@/lib/api-client";

type Backlink = { id: string; title: string; updatedAt: string };

export function BacklinksPanel({ noteId }: { noteId: string }) {
  const { data: backlinks } = useSWR<Backlink[]>(`/api/notes/${noteId}/backlinks`, fetcher);

  if (!backlinks || backlinks.length === 0) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Link2 className="size-3.5" /> Notas que linkam para esta ({backlinks.length})
      </h3>
      <ul className="space-y-1">
        {backlinks.map((b) => (
          <li key={b.id}>
            <Link
              href={`/notes/${b.id}`}
              className="block truncate rounded-md border bg-card px-2.5 py-1.5 text-sm hover:border-primary/40 hover:bg-accent/40"
            >
              {b.title || "Nota sem título"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
