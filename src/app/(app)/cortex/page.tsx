"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Brain, CalendarRange, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { fetcher, postJSON, deleteJSON } from "@/lib/api-client";
import type { NoteListItem, TagDTO } from "@/types/models";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Rascunhos de sessão (Córtex) — fora do pipeline de estágios, por isso
 * numa aba separada em vez de aparecer em "Todas as notas". Um trecho vira
 * Estímulo de verdade só quando extraído (botão dentro da própria nota).
 */
export default function CortexPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirm, ConfirmDialog } = useConfirm();
  const [opening, setOpening] = useState(false);

  const { data: allTags } = useSWR<TagDTO[]>("/api/tags", fetcher);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debouncedQ = useDebounced(q, 400);
  const tagsParam = searchParams.get("tags") ?? "";
  const selectedTagIds = useMemo(() => tagsParam.split(",").filter(Boolean), [tagsParam]);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debouncedQ !== (searchParams.get("q") ?? "")) setParams({ q: debouncedQ || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  function toggleTag(id: string) {
    const next = selectedTagIds.includes(id) ? selectedTagIds.filter((t) => t !== id) : [...selectedTagIds, id];
    setParams({ tags: next.length ? next.join(",") : null });
  }

  const hasFilters = !!(q || selectedTagIds.length || from || to);
  function clearAll() {
    setQ("");
    router.push(pathname);
  }

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("types", "CORTEX");
    if (selectedTagIds.length) params.set("tagIds", selectedTagIds.join(","));
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/notes?${params.toString()}`;
  }, [selectedTagIds, q, from, to]);

  const { data: notes, isLoading } = useSWR<NoteListItem[]>(query, fetcher);

  async function openToday() {
    setOpening(true);
    try {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const note = await postJSON<{ id: string }>("/api/notes/daily", { date });
      router.push(`/notes/${note.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir a sessão de hoje.");
    } finally {
      setOpening(false);
    }
  }

  async function removeNote(e: React.MouseEvent, note: NoteListItem) {
    e.stopPropagation();
    const ok = await confirm({
      title: `Mover "${note.title || "Sessão sem título"}" pra lixeira?`,
      description: "Fica lá por 30 dias — dá pra restaurar a qualquer momento antes disso.",
      confirmLabel: "Mover pra lixeira",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(`/api/notes/${note.id}`);
      await mutate(query);
      toast.success("Sessão movida pra lixeira.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir a sessão.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Córtex</h1>
          </div>
          <Button onClick={openToday} disabled={opening}>
            <Plus /> Sessão de hoje
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Rascunhos de sessão, fora do pipeline de estágios. Selecione um trecho dentro de uma sessão e
          use &quot;Extrair pra Estímulo&quot; pra processá-lo de verdade.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar sessões..."
              className="h-8 w-56 pl-8"
            />
          </div>

          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm" className="h-8">
                  <Tags className="size-3.5" />
                  Tags
                  {selectedTagIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
                      {selectedTagIds.length}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-56">
              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {(allTags ?? []).length === 0 && (
                  <p className="px-1 py-1 text-xs text-muted-foreground">Nenhuma tag criada ainda.</p>
                )}
                {allTags?.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent">
                    <Checkbox checked={selectedTagIds.includes(tag.id)} onCheckedChange={() => toggleTag(tag.id)} />
                    {tag.name}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm" className="h-8">
                  <CalendarRange className="size-3.5" />
                  Data
                  {(from || to) && <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">•</Badge>}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-64 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input type="date" value={from} onChange={(e) => setParams({ from: e.target.value || null })} className="h-8" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input type="date" value={to} onChange={(e) => setParams({ to: e.target.value || null })} className="h-8" />
              </div>
              {(from || to) && (
                <Button variant="ghost" size="sm" className="h-7 w-full" onClick={() => setParams({ from: null, to: null })}>
                  Limpar data
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearAll}>
              <X className="size-3.5" /> Limpar filtros
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && notes && notes.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <Brain className="size-8" />
            <p>Nenhuma sessão encontrada.</p>
            <Button variant="outline" onClick={openToday}>
              <Plus /> Abrir sessão de hoje
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {notes?.map((note) => (
            <div
              key={note.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/notes/${note.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/notes/${note.id}`)}
              className="group/note-card flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 font-medium">{note.title || "Sessão sem título"}</h3>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-muted-foreground">{formatDate(note.updatedAt)}</span>
                  <button
                    type="button"
                    onClick={(e) => removeNote(e, note)}
                    title="Excluir sessão"
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
          ))}
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
