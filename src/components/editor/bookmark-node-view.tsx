"use client";

import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ExternalLink, Globe, Trash2 } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type PreviewData = { title: string; description: string | null; image: string | null; favicon: string | null };

export function BookmarkNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const url = String(node.attrs.url ?? "");
  const loaded = Boolean(node.attrs.loaded);
  const [loading, setLoading] = useState(!loaded);
  const [imageFailed, setImageFailed] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (loaded || !url) return;
    // loading já começa true (useState(!loaded)) — não precisa setar de novo aqui.
    let cancelled = false;
    fetcher<PreviewData>(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((data) => {
        if (!cancelled) updateAttributes({ ...data, loaded: true });
      })
      .catch(() => {
        // Sem prévia, sem drama — o bookmark continua clicável, só sem
        // título/imagem. Marca como "loaded" pra não ficar tentando de novo.
        if (!cancelled) updateAttributes({ loaded: true });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, loaded]);

  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // url inválida (não devia acontecer, só uma guarda) — mostra como veio
  }

  const title = (node.attrs.title as string) || hostname || url;
  const description = node.attrs.description as string | null;
  const image = node.attrs.image as string | null;
  const favicon = node.attrs.favicon as string | null;

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="group/bookmark relative my-2"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        {loading ? (
          <div className="flex-1 animate-pulse px-3 py-3 text-sm text-muted-foreground">Carregando prévia...</div>
        ) : (
          <>
            <div className="min-w-0 flex-1 px-3 py-2.5">
              <p className="line-clamp-1 text-sm font-medium text-foreground">{title}</p>
              {description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</p>}
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element -- favicon externo, sem domínio pra otimizar
                  <img src={favicon} alt="" className="size-3.5 shrink-0 rounded-sm" onError={() => setImageFailed(true)} />
                ) : (
                  <Globe className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{hostname}</span>
                <ExternalLink className="size-3 shrink-0 opacity-60" />
              </div>
            </div>
            {image && !imageFailed && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem externa (og:image), sem domínio pra otimizar
              <img
                src={image}
                alt=""
                className="h-auto w-28 shrink-0 object-cover"
                onError={() => setImageFailed(true)}
              />
            )}
          </>
        )}
      </a>
      {focused && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-6 bg-card/80 text-muted-foreground hover:text-destructive"
          onClick={() => deleteNode()}
          title="Remover bookmark"
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </NodeViewWrapper>
  );
}
