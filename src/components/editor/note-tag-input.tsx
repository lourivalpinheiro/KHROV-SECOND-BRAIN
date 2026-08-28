"use client";

import { useState } from "react";
import useSWR from "swr";
import { X, Tag as TagIcon } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import type { TagDTO } from "@/types/models";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function NoteTagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const { data: allTags } = useSWR<TagDTO[]>("/api/tags", fetcher);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const suggestions = (allTags ?? [])
    .map((t) => t.name)
    .filter((name) => !value.includes(name))
    .filter((name) => name.toLowerCase().includes(query.toLowerCase()));

  function addTag(name: string) {
    const clean = name.trim();
    if (!clean || value.includes(clean)) return;
    onChange([...value, clean]);
    setQuery("");
  }

  function removeTag(name: string) {
    onChange(value.filter((t) => t !== name));
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      <TagIcon className="size-3.5 text-muted-foreground" />
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button onClick={() => removeTag(tag)} className="rounded-sm hover:bg-muted-foreground/20">
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              addTag(query);
              setOpen(false);
            }
          }}
          placeholder="Adicionar tag..."
          className="h-6 w-32 border-none px-1 shadow-none focus-visible:ring-0"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
            {suggestions.map((name) => (
              <button
                key={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  addTag(name);
                  setOpen(false);
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-left hover:bg-accent"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
