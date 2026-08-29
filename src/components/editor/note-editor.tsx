"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import { generateHTML } from "@tiptap/core";
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
import { exportNotesToPdf, type PdfSection } from "@/lib/export-pdf";
import { extractFlashcards } from "@/lib/flashcards";
import type { NoteDetail } from "@/types/models";
import { createWikiLinkExtension } from "./wiki-link-extension";
import { FlashcardHighlight } from "./flashcard-highlight-extension";
import { Flashcard } from "./flashcard-node";
import { EditorToolbar } from "./toolbar";
import { TableBubbleMenu } from "./table-bubble-menu";
import { NoteTagInput } from "./note-tag-input";
import { NoteTypeSelect } from "./note-type-select";
import { NOTE_TYPE_META, MIN_SYNTHESIS_LENGTH, checkPromotion, type NoteTypeValue } from "@/lib/note-types";
import { extractPlainText, extractLinkedNoteIds } from "@/lib/doc-utils";
import { AttachmentsPanel } from "./attachments-panel";
import { BacklinksPanel } from "./backlinks-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgs = useRef<Args | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const debounced = useCallback(
    (...args: Args) => {
      pendingArgs.current = args;
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        pendingArgs.current = null;
        fnRef.current(...args);
      }, delay);
    },
    [delay]
  );

  // Se o componente desmontar (ex: saiu da nota) antes do debounce disparar,
  // salva na hora em vez de deixar a última mudança se perder.
  useEffect(() => {
    return () => {
      if (timeout.current && pendingArgs.current) {
        clearTimeout(timeout.current);
        fnRef.current(...pendingArgs.current);
      }
    };
  }, []);

  return debounced;
}

export function NoteEditor({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const key = `/api/notes/${noteId}`;
  const { data: note, isLoading } = useSWR<NoteDetail>(key, fetcher);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [noteType, setNoteType] = useState<NoteTypeValue>("STIMULUS");
  const [synthesisText, setSynthesisText] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [flashcardCount, setFlashcardCount] = useState(0);
  // Direto do conteúdo atual da nota (não da tabela NoteLink, que só fica em
  // dia depois que o conteúdo é salvo) — pra trava de promoção refletir o
  // que está na nota agora, mesmo antes de qualquer save.
  const [outgoingLinksCount, setOutgoingLinksCount] = useState(0);
  const [synthesisDraft, setSynthesisDraft] = useState<string | null>(null);
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
      setOutgoingLinksCount(extractLinkedNoteIds(json).filter((id) => id !== noteId).length);
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
    setNoteType(note.type);
    setSynthesisText(note.synthesisText);
    setFlashcardCount(extractFlashcards(note.content).length);
    setOutgoingLinksCount(extractLinkedNoteIds(note.content).filter((id) => id !== note.id).length);
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

  function requestNoteTypeChange(newType: NoteTypeValue) {
    const plainText = editor ? extractPlainText(editor.getJSON()) : "";
    const check = checkPromotion(noteType, newType, {
      // Aproximação otimista — só checa se existe link nenhum. O filtro
      // anti-lixo de verdade (nota linkada precisa ter conteúdo) só o
      // servidor consegue validar; se passar aqui e falhar lá, o catch de
      // applyNoteTypeChange reverte e mostra o motivo certo.
      hasValidOutgoingLink: outgoingLinksCount > 0,
      synthesisText,
      flashcardCount,
      plainText,
    });
    if (!check.ok) {
      // A trava Potenciação→Sinapse pede um texto do usuário — em vez de só
      // bloquear, abre o diálogo pra ele escrever agora.
      if (noteType === "POTENTIATION" && newType === "SYNAPSE") {
        setSynthesisDraft(synthesisText ?? "");
        return;
      }
      toast.error(check.reason);
      return;
    }
    applyNoteTypeChange(newType);
  }

  async function applyNoteTypeChange(newType: NoteTypeValue, newSynthesisText?: string) {
    const previousType = noteType;
    const previousSynthesis = synthesisText;
    setNoteType(newType);
    if (newSynthesisText !== undefined) setSynthesisText(newSynthesisText);
    setSaveState("saving");
    try {
      await patchJSON(key, {
        type: newType,
        ...(newSynthesisText !== undefined ? { synthesisText: newSynthesisText } : {}),
      });
      await mutate("/api/notes");
      setSaveState("saved");
      toast.success(`Nota movida para "${NOTE_TYPE_META[newType].label}".`);
    } catch (err) {
      setNoteType(previousType);
      setSynthesisText(previousSynthesis);
      toast.error(err instanceof Error ? err.message : "Erro ao mudar o estágio da nota.");
    }
  }

  function submitSynthesis() {
    const text = (synthesisDraft ?? "").trim();
    const plainText = editor ? extractPlainText(editor.getJSON()) : "";
    const check = checkPromotion("POTENTIATION", "SYNAPSE", {
      hasValidOutgoingLink: outgoingLinksCount > 0,
      synthesisText: text,
      flashcardCount,
      plainText,
    });
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setSynthesisDraft(null);
    applyNoteTypeChange("SYNAPSE", text);
  }

  async function exportPdf() {
    if (!editor) return;
    const sections: PdfSection[] = [{ id: noteId, title, html: editor.getHTML() }];

    // Só o grau 1: as notas que aparecem em "Conexões feitas" desta nota,
    // não as conexões delas — pra não sair exportando o grafo inteiro.
    try {
      const backlinks = await fetcher<{
        incoming: { id: string; title: string }[];
        outgoing: { id: string; title: string }[];
      }>(`/api/notes/${noteId}/backlinks`);
      const connectedIds = new Map<string, string>();
      for (const n of [...backlinks.outgoing, ...backlinks.incoming]) {
        if (n.id !== noteId) connectedIds.set(n.id, n.title);
      }
      const connectedNotes = await Promise.all(
        Array.from(connectedIds.keys()).map((id) => fetcher<NoteDetail>(`/api/notes/${id}`))
      );
      for (const n of connectedNotes) {
        sections.push({ id: n.id, title: n.title, html: generateHTML(n.content, extensions) });
      }
    } catch {
      // Se a busca das conexões falhar, exporta só a nota principal mesmo.
    }

    exportNotesToPdf(sections);
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
    <div
      className={cn(
        "flex-1 overflow-y-auto",
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
          <NoteTypeSelect value={noteType} onChange={requestNoteTypeChange} />
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

      <Dialog open={synthesisDraft !== null} onOpenChange={(open) => !open && setSynthesisDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promover pra Sinapse</DialogTitle>
            <DialogDescription>
              Escreva a premissa fundamental que você domina, com suas próprias palavras — não copie
              trecho da nota. Mínimo de {MIN_SYNTHESIS_LENGTH} caracteres.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={6}
            value={synthesisDraft ?? ""}
            onChange={(e) => setSynthesisDraft(e.target.value)}
            placeholder="Ex: X acontece porque Y, o que implica Z..."
          />
          <p className="text-xs text-muted-foreground">
            {(synthesisDraft ?? "").trim().length} / {MIN_SYNTHESIS_LENGTH} caracteres
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSynthesisDraft(null)}>
              Cancelar
            </Button>
            <Button
              onClick={submitSynthesis}
              disabled={(synthesisDraft ?? "").trim().length < MIN_SYNTHESIS_LENGTH}
            >
              Promover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
