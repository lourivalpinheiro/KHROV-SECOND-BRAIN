"use client";

import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { fetcher, deleteJSON } from "@/lib/api-client";
import type { NoteListItem, TagDTO } from "@/types/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NotesFilterBar } from "@/components/notes-filter-bar";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { NOTE_TYPES, NOTE_TYPE_META } from "@/lib/note-types";
import { isEmptyStimulus } from "@/lib/note-health";
import { useNewNote } from "@/hooks/use-new-note";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function NotesPage() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const searchParams = useSearchParams();
  const tagId = searchParams.get("tag");
  const tagIds = searchParams.get("tags");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const types = searchParams.get("types");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (tagId) params.set("tagId", tagId);
    if (tagIds) params.set("tagIds", tagIds);
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (types) params.set("types", types);
    const qs = params.toString();
    return `/api/notes${qs ? `?${qs}` : ""}`;
  }, [tagId, tagIds, q, from, to, types]);

  const { data: notes, isLoading } = useSWR<NoteListItem[]>(query, fetcher);
  const { data: tags } = useSWR<TagDTO[]>(tagId ? "/api/tags" : null, fetcher);

  const activeTag = tags?.find((t) => t.id === tagId);
  const heading = activeTag ? `#${activeTag.name}` : "Todas as notas";

  const { requestCreate, gateDialog } = useNewNote();

  async function removeNote(e: React.MouseEvent, note: NoteListItem) {
    e.stopPropagation();
    const ok = await confirm({
      title: `Mover "${note.title || "Nota sem título"}" pra lixeira?`,
      description: "Fica lá por 30 dias — dá pra restaurar a qualquer momento antes disso.",
      confirmLabel: "Mover pra lixeira",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(`/api/notes/${note.id}`);
      await mutate(query);
      await mutate((key) => typeof key === "string" && key === "/api/tags");
      toast.success("Nota movida pra lixeira.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir a nota.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{heading}</h1>
          <Button onClick={requestCreate}>
            <Plus /> Nova nota
          </Button>
        </div>

        <NotesFilterBar />

        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && notes && notes.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <FileText className="size-8" />
            <p>Nenhuma nota encontrada.</p>
            <Button variant="outline" onClick={requestCreate}>
              <Plus /> Criar nota
            </Button>
          </div>
        )}

        <div className="space-y-8">
          {NOTE_TYPES.map((type) => {
            const group = notes?.filter((n) => n.type === type) ?? [];
            if (group.length === 0) return null;
            const meta = NOTE_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <section key={type}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold tracking-tight">{meta.label}</h2>
                  <span className="text-xs text-muted-foreground">{group.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onOpen={() => router.push(`/notes/${note.id}`)}
                      onRemove={(e) => removeNote(e, note)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {ConfirmDialog}
      {gateDialog}
    </div>
  );
}

function NoteCard({
  note,
  onOpen,
  onRemove,
}: {
  note: NoteListItem;
  onOpen: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group/note-card flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="line-clamp-1 font-medium">{note.title || "Nota sem título"}</h3>
          {isEmptyStimulus(note) && (
            <span
              className="shrink-0 rounded-full border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground"
              title="Criada mas nunca desenvolvida"
            >
              vazio
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-xs text-muted-foreground">{formatDate(note.updatedAt)}</span>
          <button
            type="button"
            onClick={onRemove}
            title="Excluir nota"
            className="rounded-md p-1 text-muted-foreground opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive pointer-fine:opacity-0 pointer-fine:group-hover/note-card:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {note.plainText && <p className="line-clamp-2 text-sm text-muted-foreground">{note.plainText}</p>}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          {note.tags.map(({ tag }) => (
            <Badge key={tag.id} variant="secondary" className="text-[11px]">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
