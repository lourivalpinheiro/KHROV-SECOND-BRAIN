"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { FilePlus2, FileText } from "lucide-react";
import { postJSON } from "@/lib/api-client";
import { EMPTY_DOC } from "@/lib/doc-utils";

export type WikiLinkSuggestionItem = {
  noteId: string | null;
  label: string;
  isNew?: boolean;
};

type CommandFn = (attrs: { noteId: string; label: string }) => void;

export const WikiLinkList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  { items: WikiLinkSuggestionItem[]; command: CommandFn }
>(function WikiLinkList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => setSelectedIndex(0), [items]);

  async function selectItem(index: number) {
    const item = items[index];
    if (!item || creating) return;

    if (item.isNew) {
      setCreating(true);
      try {
        const note = await postJSON<{ id: string; title: string }>("/api/notes", {
          title: item.label,
          content: EMPTY_DOC,
        });
        command({ noteId: note.id, label: note.title });
      } finally {
        setCreating(false);
      }
      return;
    }

    if (item.noteId) command({ noteId: item.noteId, label: item.label });
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-64 rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">
        Digite para buscar notas...
      </div>
    );
  }

  return (
    <div className="max-h-64 w-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.noteId ?? `new-${item.label}`}
          type="button"
          onClick={() => selectItem(index)}
          disabled={creating}
          className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
            index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
          }`}
        >
          {item.isNew ? (
            <FilePlus2 className="size-3.5 shrink-0 text-primary" />
          ) : (
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">
            {item.isNew ? `Criar nota "${item.label}"` : item.label}
          </span>
        </button>
      ))}
    </div>
  );
});
