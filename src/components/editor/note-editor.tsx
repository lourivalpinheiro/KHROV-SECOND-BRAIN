"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Download, Layers, Maximize2, Minimize2, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetcher, patchJSON, deleteJSON } from "@/lib/api-client";
import { exportNoteToPdf } from "@/lib/export-pdf";
import { extractFlashcards } from "@/lib/flashcards";
import type { NoteDetail } from "@/types/models";
import { createWikiLinkExtension } from "./wiki-link-extension";
import { FlashcardHighlight } from "./flashcard-highlight-extension";
import { Flashcard } from "./flashcard-node";
import { EditorToolbar } from "./toolbar";
import { TableBubbleMenu } from "./table-bubble-menu";
import { NoteTagInput } from "./note-tag-input";
import { NoteFolderSelect } from "./note-folder-select";
import { NoteTypeSelect } from "./note-type-select";
import { NOTE_TYPE_META, type NoteTypeValue } from "@/lib/note-types";
import { AttachmentsPanel } from "./attachments-panel";
import { BacklinksPanel } from "./backlinks-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: Args) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

export function NoteEditor({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const key = `/api/notes/${noteId}`;
  const { data: note, isLoading } = useSWR<NoteDetail>(key, fetcher);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<NoteTypeValue>("FLEETING");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const loadedNoteId = useRef<string | null>(null);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Escreva algo... use [[ para linkar outra nota" }),
      createWikiLinkExtension(noteId),
      FlashcardHighlight,
      Flashcard,
    ],
    [noteId]
  );

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[50vh] focus:outline-none px-3 py-4",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      debouncedSaveContent(json);
      setFlashcardCount(extractFlashcards(json).length);
    },
  });

  const saveContent = useCallback(
    async (content: unknown) => {
      setSaveState("saving");
      try {
        await patchJSON(key, { content });
        setSaveState("saved");
      } catch {
        toast.error("Erro ao salvar o conteúdo.");
      }
    },
    [key]
  );
  const debouncedSaveContent = useDebouncedCallback(saveContent, 700);

  const saveTitle = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        await patchJSON(key, { title: value });
        await mutate("/api/notes");
        setSaveState("saved");
      } catch {
        toast.error("Erro ao salvar o título.");
      }
    },
    [key]
  );
  const debouncedSaveTitle = useDebouncedCallback(saveTitle, 600);

  // Carrega o conteúdo da nota apenas uma vez por id (evita resetar o cursor a cada revalidação do SWR).
  useEffect(() => {
    if (!note || !editor || loadedNoteId.current === note.id) return;
    loadedNoteId.current = note.id;
    setTitle(note.title);
    setTags(note.tags.map((t) => t.tag.name));
    setFolderId(note.folderId);
    setNoteType(note.type);
    setFlashcardCount(extractFlashcards(note.content).length);
    // Adiado para fora do commit do efeito: evita o aviso do React sobre
    // flushSync sendo chamado durante uma renderização em andamento.
    queueMicrotask(() => {
      if (!editor.isDestroyed) {
        editor.commands.setContent(note.content ?? { type: "doc", content: [{ type: "paragraph" }] });
      }
    });
  }, [note, editor]);

  async function updateTags(newTags: string[]) {
    setTags(newTags);
    setSaveState("saving");
    try {
      await patchJSON(key, { tags: newTags });
      await mutate("/api/tags");
      setSaveState("saved");
    } catch {
      toast.error("Erro ao salvar as tags.");
    }
  }

  async function updateFolder(newFolderId: string | null) {
    setFolderId(newFolderId);
    setSaveState("saving");
    try {
      await patchJSON(key, { folderId: newFolderId });
      await mutate("/api/folders");
      await mutate("/api/notes");
      setSaveState("saved");
    } catch {
      toast.error("Erro ao mover a nota.");
    }
  }

  async function updateNoteType(newType: NoteTypeValue) {
    const previous = noteType;
    setNoteType(newType);
    setSaveState("saving");
    try {
      await patchJSON(key, { type: newType });
      await mutate("/api/notes");
      setSaveState("saved");
      toast.success(`Nota movida para "${NOTE_TYPE_META[newType].label}".`);
    } catch {
      setNoteType(previous);
      toast.error("Erro ao mudar o estágio da nota.");
    }
  }

  function exportPdf() {
    if (!editor) return;
    exportNoteToPdf(title, editor.getHTML());
  }

  async function removeNote() {
    const ok = await confirm({
      title: "Excluir esta nota?",
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(key);
      await mutate("/api/notes");
      toast.success("Nota excluída.");
      router.push("/notes");
    } catch {
      toast.error("Erro ao excluir a nota.");
    }
  }

  if (isLoading || !note) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Carregando nota...</div>;
  }

  return (
    <ScrollArea
      className={cn(
        "flex-1",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8",
          isFullscreen && "max-w-4xl"
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              debouncedSaveTitle(e.target.value);
            }}
            placeholder="Nota sem título"
            className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-3xl"
          />
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title={isFullscreen ? "Sair da tela cheia (Esc)" : "Maximizar editor"}
              onClick={() => setIsFullscreen((v) => !v)}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportPdf}>
                  <Download /> Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={removeNote}>
                  <Trash2 /> Excluir nota
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <NoteTypeSelect value={noteType} onChange={updateNoteType} />
          <NoteFolderSelect value={folderId} onChange={updateFolder} />
          <NoteTagInput value={tags} onChange={updateTags} />
        </div>

        <div className="rounded-lg border">
          <EditorToolbar editor={editor} />
          <TableBubbleMenu editor={editor} />
          <EditorContent editor={editor} />
          {flashcardCount > 0 && (
            <div className="flex items-center gap-1.5 border-t px-3 py-1.5 text-xs text-muted-foreground">
              <Layers className="size-3.5 text-primary" />
              {flashcardCount} {flashcardCount === 1 ? "flashcard" : "flashcards"} nesta nota
            </div>
          )}
        </div>

        {!isFullscreen && (
          <div className="mt-6 space-y-6">
            <AttachmentsPanel noteId={noteId} />
            <BacklinksPanel noteId={noteId} />
          </div>
        )}
      </div>
      {ConfirmDialog}
    </ScrollArea>
  );
}
