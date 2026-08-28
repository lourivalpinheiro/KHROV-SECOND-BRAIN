"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

export function WikiLinkNodeView({ node }: NodeViewProps) {
  const router = useRouter();
  const noteId = node.attrs.noteId as string | null;
  const label = (node.attrs.label as string) || "";

  return (
    <NodeViewWrapper as="span" className="inline">
      <button
        type="button"
        contentEditable={false}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (noteId) router.push(`/notes/${noteId}`);
        }}
        className="mx-0.5 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 align-baseline text-primary font-medium cursor-pointer hover:bg-primary/20"
      >
        <Link2 className="size-3" />
        {label}
      </button>
    </NodeViewWrapper>
  );
}
