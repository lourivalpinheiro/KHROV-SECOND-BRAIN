"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarRange, Search, Tags, X, ListFilter } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import type { TagDTO } from "@/types/models";
import { NOTE_TYPES, NOTE_TYPE_META } from "@/lib/note-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function NotesFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: allTags } = useSWR<TagDTO[]>("/api/tags", fetcher);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debouncedQ = useDebounced(q, 400);

  const selectedTagIds = searchParams.get("tags")?.split(",").filter(Boolean) ?? [];
  const selectedTypes = searchParams.get("types")?.split(",").filter(Boolean) ?? [];
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
    if (debouncedQ !== (searchParams.get("q") ?? "")) {
      setParams({ q: debouncedQ || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  function toggleTag(id: string) {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((t) => t !== id)
      : [...selectedTagIds, id];
    setParams({ tags: next.length ? next.join(",") : null });
  }

  function toggleType(type: string) {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    setParams({ types: next.length ? next.join(",") : null });
  }

  const hasFilters = !!(
    q ||
    selectedTagIds.length ||
    selectedTypes.length ||
    from ||
    to ||
    searchParams.get("tag")
  );

  function clearAll() {
    setQ("");
    router.push(pathname);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título ou conteúdo..."
          className="h-8 w-56 pl-8"
        />
      </div>

      <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-8">
              <ListFilter className="size-3.5" />
              Tipo
              {selectedTypes.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
                  {selectedTypes.length}
                </Badge>
              )}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-64">
          <div className="space-y-0.5">
            {NOTE_TYPES.map((type) => {
              const meta = NOTE_TYPE_META[type];
              const Icon = meta.icon;
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <Icon className="size-3.5 text-muted-foreground" />
                  {meta.label}
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

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
              <label
                key={tag.id}
                className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selectedTagIds.includes(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
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
            <Input
              type="date"
              value={from}
              onChange={(e) => setParams({ from: e.target.value || null })}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setParams({ to: e.target.value || null })}
              className="h-8"
            />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full"
              onClick={() => setParams({ from: null, to: null })}
            >
              Limpar data
            </Button>
          )}
        </PopoverContent>
      </Popover>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearAll}>
          <X className="size-3.5" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
