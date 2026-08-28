"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Folder as FolderIcon,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { fetcher, postJSON, patchJSON, deleteJSON } from "@/lib/api-client";
import type { FolderDTO } from "@/types/models";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DialogState =
  | { mode: "create-root" }
  | { mode: "create-sub"; parentId: string }
  | { mode: "rename"; folder: FolderDTO }
  | null;

export function FolderTree() {
  const { data: folders, isLoading } = useSWR<FolderDTO[]>("/api/folders", fetcher);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get("folder");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FolderDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const byParent = useMemo(() => {
    const map = new Map<string | null, FolderDTO[]>();
    for (const f of folders ?? []) {
      const key = f.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return map;
  }, [folders]);

  function openDialog(state: DialogState) {
    setName(state && state.mode === "rename" ? state.folder.name : "");
    setDialog(state);
  }

  async function submitDialog() {
    if (!dialog || !name.trim()) return;
    setPending(true);
    try {
      if (dialog.mode === "create-root") {
        await postJSON("/api/folders", { name: name.trim() });
      } else if (dialog.mode === "create-sub") {
        await postJSON("/api/folders", { name: name.trim(), parentId: dialog.parentId });
      } else if (dialog.mode === "rename") {
        await patchJSON(`/api/folders/${dialog.folder.id}`, { name: name.trim() });
      }
      await mutate("/api/folders");
      setDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar pasta.");
    } finally {
      setPending(false);
    }
  }

  async function removeFolder(deleteNotes: boolean) {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJSON(`/api/folders/${deleteTarget.id}?deleteNotes=${deleteNotes}`);
      await mutate("/api/folders");
      await mutate((key) => typeof key === "string" && key.startsWith("/api/notes"));
      if (activeFolderId === deleteTarget.id) router.push("/notes");
      toast.success(
        deleteNotes ? "Pasta e notas excluídas." : "Pasta excluída. As notas ficaram sem pasta."
      );
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir pasta.");
    } finally {
      setDeleting(false);
    }
  }

  function renderNode(folder: FolderDTO, level: number) {
    const children = byParent.get(folder.id) ?? [];
    const isActive = activeFolderId === folder.id;

    return (
      <SidebarMenuItem key={folder.id}>
        <div className="group/folder flex items-center">
          <SidebarMenuButton
            isActive={isActive}
            onClick={() => router.push(`/notes?folder=${folder.id}`)}
            style={{ paddingLeft: `${0.5 + level * 0.85}rem` }}
            tooltip={folder.name}
          >
            <FolderIcon />
            <span className="truncate">{folder.name}</span>
            {typeof folder._count?.notes === "number" && folder._count.notes > 0 && (
              <span className="ml-auto text-xs text-sidebar-foreground/50">
                {folder._count.notes}
              </span>
            )}
          </SidebarMenuButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 group-hover/folder:opacity-100 group-data-[collapsible=icon]:hidden"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => openDialog({ mode: "create-sub", parentId: folder.id })}>
                <FolderPlus /> Nova subpasta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDialog({ mode: "rename", folder })}>
                <Pencil /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(folder)}>
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {children.length > 0 && (
          <SidebarMenuSub className="mr-0 pr-0">
            {children.map((child) => renderNode(child, level + 1))}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  }

  const roots = byParent.get(null) ?? [];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pastas</SidebarGroupLabel>
      <SidebarGroupAction title="Nova pasta" onClick={() => openDialog({ mode: "create-root" })}>
        <FolderPlus />
      </SidebarGroupAction>
      <SidebarMenu className="gap-1">
        {roots.map((f) => renderNode(f, 0))}
        {!isLoading && roots.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
            Nenhuma pasta ainda.
          </p>
        )}
      </SidebarMenu>

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "rename" ? "Renomear pasta" : "Nova pasta"}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome da pasta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitDialog()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={submitDialog} disabled={pending || !name.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta &ldquo;{deleteTarget?.name}&rdquo;</AlertDialogTitle>
            <AlertDialogDescription>
              O que fazer com as notas que estão dentro dela (e de eventuais subpastas)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-col sm:items-stretch">
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => removeFolder(false)}
            >
              Manter notas (movê-las para &ldquo;Sem pasta&rdquo;)
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => removeFolder(true)}
            >
              <Trash2 /> Excluir pasta e todas as notas
            </Button>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarGroup>
  );
}
