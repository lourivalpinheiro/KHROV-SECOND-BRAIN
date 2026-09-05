"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VideoEmbedNodeView({ node, deleteNode }: NodeViewProps) {
  const embedUrl = (node.attrs.embedUrl as string) || "";
  const [focused, setFocused] = useState(false);

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="group/video relative my-2"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <div className="aspect-video overflow-hidden rounded-lg border bg-black">
        {embedUrl && (
          <iframe
            src={embedUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Vídeo incorporado"
          />
        )}
      </div>
      {focused && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-6 bg-card/80 text-muted-foreground hover:text-destructive"
          onClick={() => deleteNode()}
          title="Remover vídeo"
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </NodeViewWrapper>
  );
}
