"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { Tag as TagIcon, Plus, Trash2 } from "lucide-react";
import { fetcher, postJSON, deleteJSON } from "@/lib/api-client";
import type { TagDTO } from "@/types/models";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

export function TagList() {
  const { data: tags, isLoading } = useSWR<TagDTO[]>("/api/tags", fetcher);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmDialog } = useConfirm();
  const activeTagId = searchParams.get("tag");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function createTag() {
    if (!name.trim()) return;
    setPending(true);
    try {
      await postJSON("/api/tags", { name: name.trim() });
      await mutate("/api/tags");
      setOpen(false);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar tag.");
    } finally {
      setPending(false);
    }
  }

  async function removeTag(tag: TagDTO, e: React.MouseEvent) {
    e.stopPropagation();
    const ok = await confirm({ title: `Excluir a tag "${tag.name}"?`, confirmLabel: "Excluir", destructive: true });
    if (!ok) return;
    try {
      await deleteJSON(`/api/tags/${tag.id}`);
      await mutate("/api/tags");
      if (activeTagId === tag.id) router.push("/notes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir tag.");
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Tags</SidebarGroupLabel>
      <SidebarGroupAction title="Nova tag" onClick={() => setOpen(true)}>
        <Plus />
      </SidebarGroupAction>
      <SidebarMenu className="gap-1">
        {(tags ?? []).map((tag) => (
          <SidebarMenuItem key={tag.id} className="group/tag">
            <SidebarMenuButton
              isActive={activeTagId === tag.id}
              onClick={() => router.push(`/notes?tag=${tag.id}`)}
              tooltip={tag.name}
            >
              <TagIcon />
              <span className="truncate">{tag.name}</span>
              {typeof tag._count?.notes === "number" && tag._count.notes > 0 && (
                <span className="ml-auto text-xs text-sidebar-foreground/50 group-hover/tag:hidden">
                  {tag._count.notes}
                </span>
              )}
              <button
                onClick={(e) => removeTag(tag, e)}
                className="ml-auto hidden size-3.5 shrink-0 text-sidebar-foreground/50 hover:text-destructive group-hover/tag:block group-data-[collapsible=icon]:hidden"
              >
                <Trash2 className="size-3.5" />
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {!isLoading && (tags ?? []).length === 0 && (
          <p className="px-2 py-1.5 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
            Nenhuma tag ainda.
          </p>
        )}
      </SidebarMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova tag</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome da tag"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTag()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createTag} disabled={pending || !name.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </SidebarGroup>
  );
}
