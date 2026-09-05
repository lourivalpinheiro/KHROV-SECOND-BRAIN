"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ExternalLink, File, FileImage, FileText, FileVideo, Loader2, Trash2 } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Devolve o elemento já pronto (não o componente em si) — passar o
// componente escolhido dinamicamente pra virar `<Icon />` conta como
// "criar componente durante a renderização" pro linter do React
// Compiler, mesmo escolhendo entre componentes fixos como estes.
function fileIcon(mimeType: string, className: string) {
  if (mimeType.startsWith("image/")) return <FileImage className={className} />;
  if (mimeType.startsWith("video/")) return <FileVideo className={className} />;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return <FileText className={className} />;
  return <File className={className} />;
}

/**
 * Arquivo incorporado no corpo da nota — mesmo Attachment (Supabase
 * Storage) que aparece no painel embaixo, só que também referenciado
 * aqui como um bloco, no lugar onde faz sentido no texto. Se o anexo for
 * excluído pelo painel, o bloco continua ali mas o clique passa a falhar
 * (aviso, sem drama) — não há limpeza automática de embeds órfãos.
 */
export function FileEmbedNodeView({ node, deleteNode }: NodeViewProps) {
  const attachmentId = node.attrs.attachmentId as string;
  const filename = (node.attrs.filename as string) || "Arquivo";
  const mimeType = (node.attrs.mimeType as string) || "";
  const size = Number(node.attrs.size) || 0;
  const [focused, setFocused] = useState(false);
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    try {
      const { url } = await fetcher<{ url: string }>(`/api/attachments/${attachmentId}`);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir o arquivo.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="group/file relative my-2"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <button
        type="button"
        onClick={open}
        disabled={opening}
        className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
      >
        {opening ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          fileIcon(mimeType, "size-5 shrink-0 text-muted-foreground")
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{filename}</p>
          <p className="text-xs text-muted-foreground">{formatSize(size)}</p>
        </div>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {focused && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-6 bg-card/80 text-muted-foreground hover:text-destructive"
          onClick={() => deleteNode()}
          title="Remover bloco (o anexo continua no painel abaixo)"
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </NodeViewWrapper>
  );
}
