"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BrainCircuit, CalendarDays, FileText, Layers, Network, Plus, Search } from "lucide-react";
import { postJSON } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { FolderTree } from "@/components/folder-tree";
import { TagList } from "@/components/tag-list";
import { UserMenu } from "@/components/user-menu";

export function AppSidebar({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [openingDaily, setOpeningDaily] = useState(false);
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  async function createNote() {
    setCreating(true);
    try {
      const note = await postJSON<{ id: string }>("/api/notes", {});
      router.push(`/notes/${note.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar nota.");
    } finally {
      setCreating(false);
    }
  }

  async function openDailyNote() {
    setOpeningDaily(true);
    try {
      // Data local do usuário (não a do servidor) — pra "hoje" bater com o
      // relógio de quem está usando o app, não com o fuso da Vercel.
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const note = await postJSON<{ id: string }>("/api/notes/daily", { date });
      router.push(`/notes/${note.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir a nota do dia.");
    } finally {
      setOpeningDaily(false);
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/notes?q=${encodeURIComponent(q.trim())}` : "/notes");
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-2 pt-1">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BrainCircuit className="size-4" />
          </div>
          <span className="truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Khrov
          </span>
        </div>

        <form
          onSubmit={submitSearch}
          className="relative group-data-[collapsible=icon]:hidden"
        >
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar notas..."
            className="pl-7 sm:pr-16"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Ctrl+K
          </kbd>
        </form>
      </SidebarHeader>

      <SidebarContent className="gap-4 py-2">
        <SidebarMenu className="gap-1 px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={createNote}
              disabled={creating}
              tooltip="Nova nota"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Plus /> Nova nota
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu className="gap-1 px-2">
          <SidebarMenuItem>
            <SidebarMenuButton onClick={openDailyNote} disabled={openingDaily} tooltip="Nota de hoje">
              <CalendarDays /> Nota de hoje
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/notes" && !searchParams.get("folder") && !searchParams.get("tag")}
              onClick={() => router.push("/notes")}
              tooltip="Todas as notas"
            >
              <FileText /> Todas as notas
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/graph"}
              onClick={() => router.push("/graph")}
              tooltip="Grafo"
            >
              <Network /> Grafo
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/flashcards"}
              onClick={() => router.push("/flashcards")}
              tooltip="Flashcards"
            >
              <Layers /> Flashcards
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="my-0" />

        <FolderTree />
        <TagList />
      </SidebarContent>

      <SidebarFooter>
        <UserMenu name={user.name} email={user.email} image={user.image} />
      </SidebarFooter>
    </Sidebar>
  );
}
