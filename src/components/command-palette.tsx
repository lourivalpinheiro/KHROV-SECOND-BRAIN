"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import {
  Activity,
  ArrowLeftRight,
  BookOpenText,
  Brain,
  CalendarCheck2,
  FileText,
  History,
  Layers,
  LineChart,
  Moon,
  Network,
  NotebookPen,
  PiggyBank,
  Plus,
  Settings2,
  Tag as TagIcon,
  Target,
  Thermometer,
  TrendingUp,
} from "lucide-react";
import { fetcher, postJSON } from "@/lib/api-client";
import type { TagDTO } from "@/types/models";
import { useNewNote } from "@/hooks/use-new-note";
import { MODULES, moduleFromPathname } from "@/lib/modules";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type SearchResult = { id: string; title: string };

function todayLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Busca rápida global (Cmd+K / Ctrl+K) — muda de conteúdo conforme o
 * módulo aberto no momento (ver src/lib/modules.ts): em Notas/
 * Conhecimento busca por nota/tag pelo nome, nos outros é um atalho de
 * navegação pras páginas do módulo. Trocar de módulo direto daqui
 * também funciona em qualquer um deles.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const activeModule = moduleFromPathname(pathname);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { requestCreate, gateDialog } = useNewNote();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  const { data: noteResults } = useSWR<SearchResult[]>(
    open && activeModule === "notas" ? `/api/notes/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher
  );
  const { data: tags } = useSWR<TagDTO[]>(open && activeModule === "notas" ? "/api/tags" : null, fetcher);

  const matchedTags = (tags ?? [])
    .filter((t) => t.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    .slice(0, 5);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  function createNote() {
    setOpen(false);
    requestCreate();
  }

  async function openDailyNote() {
    setOpen(false);
    const note = await postJSON<{ id: string }>("/api/notes/daily", { date: todayLocalDate() });
    router.push(`/notes/${note.id}`);
  }

  return (
    <>
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Busca rápida"
      description="Buscar ou executar uma ação"
    >
      <CommandInput
        placeholder={activeModule === "notas" ? "Buscar notas, tags..." : "Buscar uma ação..."}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {activeModule === "notas" && (
          <CommandGroup heading="Ações">
            <CommandItem onSelect={createNote}>
              <Plus /> Nova nota
            </CommandItem>
            <CommandItem onSelect={openDailyNote}>
              <Brain /> Sessão de hoje (Córtex)
            </CommandItem>
            <CommandItem onSelect={() => go("/cortex")}>
              <Brain /> Ver Córtex
            </CommandItem>
            <CommandItem onSelect={() => go("/notes")}>
              <FileText /> Todas as notas
            </CommandItem>
            <CommandItem onSelect={() => go("/graph")}>
              <Network /> Grafo
            </CommandItem>
            <CommandItem onSelect={() => go("/flashcards")}>
              <Layers /> Flashcards
            </CommandItem>
            <CommandItem onSelect={() => go("/timeline")}>
              <History /> Linha do tempo
            </CommandItem>
            <CommandItem onSelect={() => go("/conceitos")}>
              <BookOpenText /> Conceitos
            </CommandItem>
          </CommandGroup>
        )}

        {activeModule === "saude" && (
          <CommandGroup heading="Saúde">
            <CommandItem onSelect={() => go("/saude")}>
              <Activity /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/saude/semana")}>
              <CalendarCheck2 /> Semana
            </CommandItem>
            <CommandItem onSelect={() => go("/saude/caderno")}>
              <NotebookPen /> Caderno
            </CommandItem>
            <CommandItem onSelect={() => go("/saude/sono")}>
              <Moon /> Sono
            </CommandItem>
            <CommandItem onSelect={() => go("/saude/historico")}>
              <LineChart /> Histórico
            </CommandItem>
            <CommandItem onSelect={() => go("/saude/previsao")}>
              <TrendingUp /> Previsão
            </CommandItem>
            <CommandItem onSelect={() => go("/saude/perfil")}>
              <Settings2 /> Perfil
            </CommandItem>
          </CommandGroup>
        )}

        {activeModule === "financeiro" && (
          <CommandGroup heading="Financeiro">
            <CommandItem onSelect={() => go("/financeiro")}>
              <Activity /> Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/financeiro/lancamentos")}>
              <ArrowLeftRight /> Lançamentos
            </CommandItem>
            <CommandItem onSelect={() => go("/financeiro/horizonte")}>
              <Thermometer /> Horizonte
            </CommandItem>
            <CommandItem onSelect={() => go("/financeiro/cofrinhos")}>
              <PiggyBank /> Cofrinhos
            </CommandItem>
            <CommandItem onSelect={() => go("/financeiro/metas")}>
              <Target /> Metas
            </CommandItem>
            <CommandItem onSelect={() => go("/financeiro/tags")}>
              <TagIcon /> Tags
            </CommandItem>
            <CommandItem onSelect={() => go("/financeiro/perfil")}>
              <Settings2 /> Perfil
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Trocar de módulo">
          {MODULES.map((m) => {
            const MIcon = m.icon;
            return (
              <CommandItem key={m.key} value={`module-${m.key}`} onSelect={() => go(m.href)}>
                <MIcon /> {m.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {activeModule === "notas" && (noteResults?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notas">
              {noteResults!.map((n) => (
                <CommandItem key={n.id} value={`note-${n.id}`} onSelect={() => go(`/notes/${n.id}`)}>
                  <FileText /> {n.title || "Nota sem título"}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {activeModule === "notas" && debouncedQuery && matchedTags.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tags">
              {matchedTags.map((t) => (
                <CommandItem key={t.id} value={`tag-${t.id}`} onSelect={() => go(`/notes?tag=${t.id}`)}>
                  <TagIcon /> #{t.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
    {gateDialog}
    </>
  );
}
