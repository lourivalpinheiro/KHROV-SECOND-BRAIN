"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Tag as TagIcon, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { fetcher, postJSON, patchJSON, deleteJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

type FinanceTagDTO = { id: string; name: string; _count?: { entries: number } };

/**
 * Gestão das tags do módulo Financeiro num lugar só — criadas aqui (ou
 * na hora de criar um lançamento), ficam disponíveis pra agrupar em
 * Lançamentos.
 */
export default function FinanceTagsPage() {
  const { data: tags, isLoading } = useSWR<FinanceTagDTO[]>("/api/finance/tags", fetcher);
  const { confirm, ConfirmDialog } = useConfirm();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function createTag() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await postJSON("/api/finance/tags", { name: newName.trim() });
      await mutate("/api/finance/tags");
      setCreateOpen(false);
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar tag.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(tag: FinanceTagDTO) {
    setEditingId(tag.id);
    setEditName(tag.name);
  }

  async function saveEdit(tag: FinanceTagDTO) {
    const name = editName.trim();
    if (!name || name === tag.name) {
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    try {
      await patchJSON(`/api/finance/tags/${tag.id}`, { name });
      await mutate("/api/finance/tags");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao renomear tag.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeTag(tag: FinanceTagDTO) {
    const ok = await confirm({ title: `Excluir a tag "${tag.name}"?`, confirmLabel: "Excluir", destructive: true });
    if (!ok) return;
    try {
      await deleteJSON(`/api/finance/tags/${tag.id}`);
      await mutate("/api/finance/tags");
      toast.success("Tag excluída.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir tag.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TagIcon className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Tags</h1>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Nova tag
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && (tags ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <TagIcon className="size-8" />
            <p>Nenhuma tag ainda — crie uma aqui, ou direto na hora de criar um lançamento.</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus /> Criar tag
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          {(tags ?? []).map((tag) => (
            <div
              key={tag.id}
              className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-colors hover:border-primary/40"
            >
              {editingId === tag.id ? (
                <>
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(tag);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8"
                  />
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" disabled={savingEdit} onClick={() => saveEdit(tag)}>
                    <Check className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setEditingId(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-1 items-center gap-2 truncate">
                    <span className="truncate font-medium">{tag.name}</span>
                    {typeof tag._count?.entries === "number" && (
                      <span className="text-xs text-muted-foreground">
                        {tag._count.entries} {tag._count.entries === 1 ? "lançamento" : "lançamentos"}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                    title="Renomear"
                    onClick={() => startEdit(tag)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground opacity-100 hover:text-destructive pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                    title="Excluir"
                    onClick={() => removeTag(tag)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tag</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome da tag"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTag()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createTag} disabled={creating || !newName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
