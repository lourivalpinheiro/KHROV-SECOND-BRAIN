"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  BookMarked,
  BookOpenText,
  BookmarkCheck,
  Brain,
  CalendarCheck2,
  Check,
  ChevronsUpDown,
  FileText,
  HandHeart,
  HeartHandshake,
  History,
  Layers,
  LayoutDashboard,
  LineChart,
  Moon,
  Network,
  NotebookPen,
  PiggyBank,
  Plus,
  Search,
  Settings2,
  Tag as TagIcon,
  Target,
  Thermometer,
  Trash2,
  TrendingUp,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import { ENABLED_MODULES, moduleDef, moduleFromPathname } from "@/lib/modules";

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
  const activeModule = moduleFromPathname(pathname);
  const active = moduleDef(activeModule);
  const ActiveIcon = active.icon;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/notes?q=${encodeURIComponent(q.trim())}` : "/notes");
  }

  return (
    <Sidebar collapsible="icon" className={cn(active.themeClass)}>
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-2 pt-1">
          {/* size-8 pra bater exatamente com o tamanho que o SidebarMenuButton
              vira no modo colapsado (ícone) — com tamanhos diferentes, os dois
              ficam centralizados em caixas de larguras diferentes, e o ícone
              do logo sai levemente deslocado em relação aos ícones abaixo. */}
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ActiveIcon className="size-4" />
          </div>
          <span className="truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Khrov
          </span>
        </div>

        {/* Trocador de módulo — só faz sentido com mais de um módulo ativo
            (ver src/lib/modules.ts). Com um só, vira um rótulo estático em
            vez de um dropdown sem função; os outros módulos continuam
            inteiros no código, só pausados. */}
        {ENABLED_MODULES.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
                >
                  <ActiveIcon className="size-3.5 shrink-0 text-primary" />
                  <span className="flex-1 truncate text-xs font-medium">{active.label}</span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/50" />
                </button>
              }
            />
            <DropdownMenuContent align="start" className="w-56">
              {ENABLED_MODULES.map((m) => {
                const MIcon = m.icon;
                return (
                  <DropdownMenuItem key={m.key} onClick={() => router.push(m.href)}>
                    <MIcon /> {m.label}
                    <span className="ml-auto flex items-center gap-1.5">
                      {m.comingSoon && <span className="text-[10px] text-muted-foreground">em breve</span>}
                      {activeModule === m.key && <Check className="size-3.5" />}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <ActiveIcon className="size-3.5 shrink-0 text-primary" />
            <span className="flex-1 truncate text-xs font-medium">{active.label}</span>
          </div>
        )}

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
                  onClick={() => requestCreate()}
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
              <SidebarGroupLabel>Conhecimento</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/painel"}
                      onClick={() => router.push("/painel")}
                      tooltip="Painel"
                    >
                      <LayoutDashboard /> Painel
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
        ) : activeModule === "saude" ? (
          <>
            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Rotina</SidebarGroupLabel>
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
                      isActive={pathname.startsWith("/saude/caderno")}
                      onClick={() => router.push("/saude/caderno")}
                      tooltip="Caderno"
                    >
                      <NotebookPen /> Caderno
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/saude/sono"}
                      onClick={() => router.push("/saude/sono")}
                      tooltip="Sono"
                    >
                      <Moon /> Sono
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Evolução</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
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
                      isActive={pathname === "/saude/previsao"}
                      onClick={() => router.push("/saude/previsao")}
                      tooltip="Previsão"
                    >
                      <TrendingUp /> Previsão
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="my-0" />

            <SidebarMenu className="gap-1 px-2">
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
          </>
        ) : activeModule === "espiritual" ? (
          <>
            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Rotina</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={pathname === "/espiritual"} onClick={() => router.push("/espiritual")} tooltip="Dashboard">
                      <Activity /> Dashboard
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/espiritual/semana"}
                      onClick={() => router.push("/espiritual/semana")}
                      tooltip="Semana"
                    >
                      <CalendarCheck2 /> Semana
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/espiritual/gratidao"}
                      onClick={() => router.push("/espiritual/gratidao")}
                      tooltip="Gratidão"
                    >
                      <HeartHandshake /> Gratidão
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Pregação</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/espiritual/sermoes")}
                      onClick={() => router.push("/espiritual/sermoes")}
                      tooltip="Sermões"
                    >
                      <BookOpenText /> Sermões
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Crescimento</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/espiritual/biblia"}
                      onClick={() => router.push("/espiritual/biblia")}
                      tooltip="Bíblia"
                    >
                      <BookMarked /> Bíblia
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/espiritual/versiculos"}
                      onClick={() => router.push("/espiritual/versiculos")}
                      tooltip="Versículos"
                    >
                      <BookmarkCheck /> Versículos
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/espiritual/oracoes"}
                      onClick={() => router.push("/espiritual/oracoes")}
                      tooltip="Pedidos de oração"
                    >
                      <HandHeart /> Pedidos de oração
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="my-0" />

            <SidebarMenu className="gap-1 px-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/espiritual/perfil"}
                  onClick={() => router.push("/espiritual/perfil")}
                  tooltip="Perfil"
                >
                  <Settings2 /> Perfil
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : (
          <>
            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Movimentar</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/financeiro"}
                      onClick={() => router.push("/financeiro")}
                      tooltip="Dashboard"
                    >
                      <Activity /> Dashboard
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/financeiro/lancamentos")}
                      onClick={() => router.push("/financeiro/lancamentos")}
                      tooltip="Lançamentos"
                    >
                      <ArrowLeftRight /> Lançamentos
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/financeiro/horizonte"}
                      onClick={() => router.push("/financeiro/horizonte")}
                      tooltip="Horizonte"
                    >
                      <Thermometer /> Horizonte
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Guardar</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname.startsWith("/financeiro/cofrinhos")}
                      onClick={() => router.push("/financeiro/cofrinhos")}
                      tooltip="Cofrinhos"
                    >
                      <PiggyBank /> Cofrinhos
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/financeiro/metas"}
                      onClick={() => router.push("/financeiro/metas")}
                      tooltip="Metas"
                    >
                      <Target /> Metas
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0 px-2">
              <SidebarGroupLabel>Organizar</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={pathname === "/financeiro/tags"}
                      onClick={() => router.push("/financeiro/tags")}
                      tooltip="Tags"
                    >
                      <TagIcon /> Tags
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="my-0" />

            <SidebarMenu className="gap-1 px-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/financeiro/perfil"}
                  onClick={() => router.push("/financeiro/perfil")}
                  tooltip="Perfil"
                >
                  <Settings2 /> Perfil
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu name={user.name} email={user.email} image={user.image} />
      </SidebarFooter>
      {gateDialog}
    </Sidebar>
  );
}
