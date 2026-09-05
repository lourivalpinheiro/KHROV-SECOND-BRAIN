"use client";

import { useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { ExternalLink, File, Loader2, Paperclip, Trash2 } from "lucide-react";
import { fetcher, deleteJSON } from "@/lib/api-client";
import { supabaseBrowser, isSupabaseBrowserConfigured } from "@/lib/supabase-browser";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments-bucket";
import type { AttachmentDTO } from "@/types/models";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsPanel({ noteId }: { noteId: string }) {
  const key = `/api/notes/${noteId}`;
  const { data: note } = useSWR<{ attachments: AttachmentDTO[] }>(key, fetcher);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!isSupabaseBrowserConfigured || !supabaseBrowser) {
      toast.error("Armazenamento de anexos ainda não foi configurado.");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { token, storageKey } = await fetch("/api/attachments/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId, filename: file.name }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Falha ao preparar upload.");
          }
          return res.json();
        });

        // Upload direto pro Supabase Storage com o signed URL — o
        // arquivo nunca passa pela nossa função serverless (evita o
        // limite de payload da Vercel pra arquivos grandes), mesmo
        // desenho que era usado com o Cloudflare R2 antes dessa troca.
        const { error: uploadError } = await supabaseBrowser.storage
          .from(ATTACHMENTS_BUCKET)
          .uploadToSignedUrl(storageKey, token, file);
        if (uploadError) throw new Error(uploadError.message);

        await fetch("/api/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId,
            filename: file.name,
            storageKey,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          }),
        });
      }
      await mutate(key);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar anexo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openAttachment(attachment: AttachmentDTO) {
    try {
      const { url } = await fetcher<{ url: string }>(`/api/attachments/${attachment.id}`);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir anexo.");
    }
  }

  async function remove(attachment: AttachmentDTO) {
    const ok = await confirm({ title: `Excluir "${attachment.filename}"?`, confirmLabel: "Excluir", destructive: true });
    if (!ok) return;
    try {
      await deleteJSON(`/api/attachments/${attachment.id}`);
      await mutate(key);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir anexo.");
    }
  }

  const attachments = note?.attachments ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Paperclip className="size-3.5" /> Anexos
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          Anexar arquivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </div>

      {attachments.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum anexo nesta nota.</p>
      )}

      <ul className="space-y-1">
        {attachments.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm"
          >
            <File className="size-4 shrink-0 text-muted-foreground" />
            <button
              type="button"
              onClick={() => openAttachment(a)}
              className="min-w-0 flex-1 truncate text-left hover:underline"
              title="Abrir em outra aba"
            >
              {a.filename}
            </button>
            <span className="shrink-0 text-xs text-muted-foreground">{formatSize(a.size)}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => openAttachment(a)}>
              <ExternalLink className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => remove(a)}>
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      {ConfirmDialog}
    </div>
  );
}
