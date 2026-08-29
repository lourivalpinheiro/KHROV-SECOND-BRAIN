"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { FolderDTO } from "@/types/models";
import { flattenFolders } from "@/lib/folder-tree";
import { Folder } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function NoteFolderSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (folderId: string | null) => void;
}) {
  const { data: folders } = useSWR<FolderDTO[]>("/api/folders", fetcher);
  const options = useMemo(() => flattenFolders(folders ?? []), [folders]);
  const labelById = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);

  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger size="sm" className="h-7 gap-1.5 border-none bg-transparent px-2 shadow-none">
        <Folder className="size-3.5 text-muted-foreground" />
        <SelectValue>
          {(v: string) => (v === "__none__" ? "Sem pasta" : (labelById.get(v) ?? "Sem pasta"))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Sem pasta</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
