"use client";

import { useRef, useState } from "react";
import { mutate } from "swr";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Layers,
  BarChart3,
  MessageSquareWarning,
  Video,
  Paperclip,
  Loader2,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabaseBrowser, isSupabaseBrowserConfigured } from "@/lib/supabase-browser";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments-bucket";
import { parseVideoUrl } from "@/lib/video-embed";
import { toast } from "sonner";

function Item({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle size="sm" pressed={!!active} disabled={disabled} onPressedChange={onClick}>
            {children}
          </Toggle>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({ editor, noteId }: { editor: Editor | null; noteId: string }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addLink() {
    const previousUrl = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link:", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function addImage() {
    const url = window.prompt("URL da imagem:");
    if (url) editor!.chain().focus().setImage({ src: url }).run();
  }

  function addVideo() {
    const url = window.prompt("URL do vídeo (YouTube ou Vimeo):");
    if (!url) return;
    if (!parseVideoUrl(url)) {
      toast.error("Não reconheci essa URL como YouTube ou Vimeo.");
      return;
    }
    editor!.chain().focus().insertVideoEmbed({ url }).run();
  }

  // Mesmo fluxo de 3 passos do AttachmentsPanel (signed URL → upload
  // direto pro Supabase Storage → registra a metadata) — só que termina
  // inserindo um bloco no corpo em vez de só listar no painel embaixo.
  // O Attachment criado é o mesmo dos dois lugares, por isso atualiza a
  // mesma chave de SWR da nota (pro painel de anexos refletir na hora).
  async function uploadFile(file: File) {
    if (!isSupabaseBrowserConfigured || !supabaseBrowser) {
      toast.error("Armazenamento de anexos ainda não foi configurado.");
      return;
    }
    setUploading(true);
    try {
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

      const { error: uploadError } = await supabaseBrowser.storage
        .from(ATTACHMENTS_BUCKET)
        .uploadToSignedUrl(storageKey, token, file);
      if (uploadError) throw new Error(uploadError.message);

      const mimeType = file.type || "application/octet-stream";
      const attachment = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, filename: file.name, storageKey, mimeType, size: file.size }),
      }).then((res) => res.json());

      editor!
        .chain()
        .focus()
        .insertFileEmbed({ attachmentId: attachment.id, filename: file.name, mimeType, size: file.size })
        .run();
      await mutate(`/api/notes/${noteId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b bg-background/60 px-2 py-1.5 [&>*]:shrink-0">
      <Item label="Negrito" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </Item>
      <Item label="Itálico" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </Item>
      <Item label="Sublinhado" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon />
      </Item>
      <Item label="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough />
      </Item>
      <Item label="Código" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code />
      </Item>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Item label="Título 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 />
      </Item>
      <Item label="Título 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </Item>
      <Item label="Título 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </Item>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Item label="Lista" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </Item>
      <Item label="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered />
      </Item>
      <Item label="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListTodo />
      </Item>
      <Item label="Citação" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote />
      </Item>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Item label="Alinhar à esquerda" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft />
      </Item>
      <Item label="Centralizar" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter />
      </Item>
      <Item label="Alinhar à direita" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight />
      </Item>
      <Item label="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify />
      </Item>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Item label="Link" active={editor.isActive("link")} onClick={addLink}>
        <LinkIcon />
      </Item>
      <Item label="Imagem" onClick={addImage}>
        <ImageIcon />
      </Item>
      <Item label="Vídeo (YouTube/Vimeo)" onClick={addVideo}>
        <Video />
      </Item>
      <Item label="Anexar arquivo" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
      </Item>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
      />
      <Item
        label="Tabela"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon />
      </Item>
      <Item label="Linha horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus />
      </Item>
      <Item label="Flashcard" onClick={() => editor.chain().focus().insertFlashcard().run()}>
        <Layers />
      </Item>
      <Item label="Gráfico" onClick={() => editor.chain().focus().insertChart().run()}>
        <BarChart3 />
      </Item>
      <Item label="Callout" active={editor.isActive("callout")} onClick={() => editor.chain().focus().setCallout().run()}>
        <MessageSquareWarning />
      </Item>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 />
      </Button>
    </div>
  );
}
