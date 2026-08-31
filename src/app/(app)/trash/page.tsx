"use client";

import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, X } from "lucide-react";
import { fetcher, postJSON, deleteJSON } from "@/lib/api-client";
import { NOTE_TYPE_META, type NoteTypeValue } from "@/lib/note-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

const RETENTION_DAYS = 30;

type TrashedNote = {
  id: string;
  title: string;
  plainText: string;
  type: NoteTypeValue;
  deletedAt: string;
};

function daysLeft(deletedAt: string) {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
}

/**
 * Lixeira: notas excluídas ficam aqui por 30 dias antes de serem apagadas
 * de vez pelo cron (src/app/api/cron/purge-trash) — dá pra restaurar
 * enquanto isso, ou excluir de vez na hora se tiver certeza.
 */
export default function TrashPage() {
  const { data: notes, isLoading } = useSWR<TrashedNote[]>("/api/notes/trash", fetcher);
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();

  async function restore(note: TrashedNote) {
    try {
      await postJSON(`/api/notes/${note.id}/restore`, {});
      await mutate("/api/notes/trash");
      await mutate((key) => typeof key === "string" && key.startsWith("/api/notes"));
      toast.success(`"${note.title || "Nota sem título"}" restaurada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao restaurar a nota.");
    }
  }

  async function purge(note: TrashedNote) {
    const ok = await confirm({
      title: `Excluir "${note.title || "Nota sem título"}" de vez?`,
      description: "Essa ação não pode ser desfeita — não passa mais pela lixeira.",
      confirmLabel: "Excluir de vez",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(`/api/notes/${note.id}/permanent`);
      await mutate("/api/notes/trash");
      toast.success("Nota excluída de vez.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir a nota.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-2 flex items-center gap-2">
          <Trash2 className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Lixeira</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Notas excluídas ficam aqui por {RETENTION_DAYS} dias antes de serem apagadas de vez.
        </p>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && (notes ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <Trash2 className="size-8" />
            <p>A lixeira está vazia.</p>
          </div>
        )}

        <div className="space-y-2">
          {(notes ?? []).map((note) => {
            const meta = NOTE_TYPE_META[note.type];
            const Icon = meta.icon;
            const left = daysLeft(note.deletedAt);
            return (
              <div
                key={note.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 opacity-90"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => router.push(`/notes/${note.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <h3 className="line-clamp-1 text-sm font-medium">{note.title || "Nota sem título"}</h3>
                  {note.plainText && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{note.plainText}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {left > 0 ? `Apagada de vez em ${left} ${left === 1 ? "dia" : "dias"}` : "Será apagada de vez em breve"}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" title="Restaurar" onClick={() => restore(note)}>
                    <RotateCcw className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Excluir de vez"
                    onClick={() => purge(note)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
