"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  BookOpenText,
  Brain,
  BrainCircuit,
  CalendarCheck2,
  FileText,
  History,
  Layers,
  LineChart,
  Network,
  NotebookPen,
  Plus,
  Search,
  Settings2,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { useNewNote } from "@/hooks/use-new-note";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

type ModuleKey = "notas" | "saude";

export function AppSidebar({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const { requestCreate, gateDialog } = useNewNote();

  // Deriva do caminho em vez de guardar estado à parte — assim um link
  // direto ou um F5 sempre abre no módulo certo, sem precisar sincronizar.
  const activeModule: ModuleKey = pathname.startsWith("/saude") ? "saude" : "notas";

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/notes?q=${encodeURIComponent(q.trim())}` : "/notes");
  }

  return (
    <Sidebar collapsible="icon" className={cn(activeModule === "saude" && "theme-saude")}>
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-2 pt-1">
          {/* size-8 pra bater exatamente com o tamanho que o SidebarMenuButton
              vira no modo colapsado (ícone) — com tamanhos diferentes, os dois
              ficam centralizados em caixas de larguras diferentes, e o ícone
              do logo sai levemente deslocado em relação aos ícones abaixo. */}
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BrainCircuit className="size-4" />
          </div>
          <span className="truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Khrov
          </span>
        </div>

        {/* Trocador de módulo — mesma casca (cabeçalho, busca, rodapé) pros
            dois, só a lista de navegação abaixo muda. */}
        <div className="flex gap-1 rounded-lg bg-sidebar-accent/50 p-0.5 group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={() => router.push("/notes")}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              activeModule === "notas"
                ? "bg-sidebar text-sidebar-foreground shadow-xs"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
          >
            Notas
          </button>
          <button
            type="button"
            onClick={() => router.push("/saude")}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              activeModule === "saude"
                ? "bg-sidebar text-sidebar-foreground shadow-xs"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
            )}
          >
            Saúde
          </button>
        </div>

        {activeModule === "notas" && (
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
        )}
      </SidebarHeader>

      <SidebarContent className="gap-4 py-2">
        {activeModule === "notas" ? (
          <>
            <SidebarMenu className="gap-1 px-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={requestCreate}
                  tooltip="Nova nota"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                >
                  <Plus /> Nova nota
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Capturar</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={pathname === "/cortex"} onClick={() => router.push("/cortex")} tooltip="Córtex">
                      <Brain /> Córtex
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Notas</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/notes" && !searchParams.get("tag")}
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
                      isActive={pathname === "/timeline"}
                      onClick={() => router.push("/timeline")}
                      tooltip="Linha do tempo"
                    >
                      <History /> Linha do tempo
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/tags"}
                      onClick={() => router.push("/tags")}
                      tooltip="Tags"
                    >
                      <TagIcon /> Tags
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Revisão</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/flashcards"}
                      onClick={() => router.push("/flashcards")}
                      tooltip="Flashcards"
                    >
                      <Layers /> Flashcards
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/conceitos"}
                      onClick={() => router.push("/conceitos")}
                      tooltip="Conceitos"
                    >
                      <BookOpenText /> Conceitos
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="my-0" />

            <SidebarMenu className="gap-1 px-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/trash"}
                  onClick={() => router.push("/trash")}
                  tooltip="Lixeira"
                >
                  <Trash2 /> Lixeira
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : (
          <SidebarGroup className="p-0 px-2">
            <SidebarGroupLabel>Saúde</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={pathname === "/saude"} onClick={() => router.push("/saude")} tooltip="Dashboard">
                    <Activity /> Dashboard
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/saude/semana"}
                    onClick={() => router.push("/saude/semana")}
                    tooltip="Semana"
                  >
                    <CalendarCheck2 /> Semana
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/saude/caderno"}
                    onClick={() => router.push("/saude/caderno")}
                    tooltip="Caderno"
                  >
                    <NotebookPen /> Caderno
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/saude/historico"}
                    onClick={() => router.push("/saude/historico")}
                    tooltip="Histórico"
                  >
                    <LineChart /> Histórico
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/saude/perfil"}
                    onClick={() => router.push("/saude/perfil")}
                    tooltip="Perfil"
                  >
                    <Settings2 /> Perfil
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu name={user.name} email={user.email} image={user.image} />
      </SidebarFooter>
      {gateDialog}
    </Sidebar>
  );
}
