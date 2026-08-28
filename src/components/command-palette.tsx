"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { CalendarDays, FileText, Folder, Layers, Network, Plus, Tag as TagIcon } from "lucide-react";
import { fetcher, postJSON } from "@/lib/api-client";
import type { FolderDTO, TagDTO } from "@/types/models";
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
 * Busca rápida global (Cmd+K / Ctrl+K): criar nota, ir pra nota de hoje,
 * pular pra grafo/flashcards, ou buscar por nota/pasta/tag pelo nome.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

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
    open ? `/api/notes/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher
  );
  const { data: folders } = useSWR<FolderDTO[]>(open ? "/api/folders" : null, fetcher);
  const { data: tags } = useSWR<TagDTO[]>(open ? "/api/tags" : null, fetcher);

  const matchedFolders = (folders ?? [])
    .filter((f) => f.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    .slice(0, 5);
  const matchedTags = (tags ?? [])
    .filter((t) => t.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    .slice(0, 5);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  async function createNote() {
    setOpen(false);
    const note = await postJSON<{ id: string }>("/api/notes", {});
    router.push(`/notes/${note.id}`);
  }

  async function openDailyNote() {
    setOpen(false);
    const note = await postJSON<{ id: string }>("/api/notes/daily", { date: todayLocalDate() });
    router.push(`/notes/${note.id}`);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Busca rápida"
      description="Buscar notas, pastas e tags, ou executar uma ação"
    >
      <CommandInput placeholder="Buscar notas, pastas, tags..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Ações">
          <CommandItem onSelect={createNote}>
            <Plus /> Nova nota
          </CommandItem>
          <CommandItem onSelect={openDailyNote}>
            <CalendarDays /> Nota de hoje
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
        </CommandGroup>

        {(noteResults?.length ?? 0) > 0 && (
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

        {debouncedQuery && matchedFolders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Pastas">
              {matchedFolders.map((f) => (
                <CommandItem key={f.id} value={`folder-${f.id}`} onSelect={() => go(`/notes?folder=${f.id}`)}>
                  <Folder /> {f.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {debouncedQuery && matchedTags.length > 0 && (
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
  );
}
