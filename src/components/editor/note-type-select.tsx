"use client";

import { ArrowRight } from "lucide-react";
import { NOTE_TYPES, NOTE_TYPE_META, nextNoteType, type NoteTypeValue } from "@/lib/note-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function NoteTypeSelect({
  value,
  onChange,
}: {
  value: NoteTypeValue;
  onChange: (type: NoteTypeValue) => void;
}) {
  const meta = NOTE_TYPE_META[value];
  const Icon = meta.icon;
  const next = nextNoteType(value);

  return (
    <div className="flex items-center gap-1">
      <Select value={value} onValueChange={(v) => onChange(v as NoteTypeValue)}>
        <SelectTrigger size="sm" className="h-7 gap-1.5 border-none bg-transparent px-2 shadow-none">
          <Icon className="size-3.5 text-muted-foreground" />
          <SelectValue>{() => meta.label}</SelectValue>
        </SelectTrigger>
        <SelectContent className="w-80 max-w-[calc(100vw-2rem)]">
          {NOTE_TYPES.map((t) => {
            const ItemIcon = NOTE_TYPE_META[t].icon;
            return (
              <SelectItem key={t} value={t} className="py-1.5">
                <span className="flex min-w-0 items-start gap-2 whitespace-normal">
                  <ItemIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col">
                    <span>{NOTE_TYPE_META[t].label}</span>
                    <span className="text-xs text-muted-foreground">{NOTE_TYPE_META[t].description}</span>
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {next && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => onChange(next)}
              >
                <ArrowRight className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Promover a &ldquo;{NOTE_TYPE_META[next].label}&rdquo;</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
