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
import {
  BookOpen,
  Brain,
  Copy,
  Download,
  EyeOff,
  Globe,
  Landmark,
  Layers,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PenLine,
  Scissors,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetcher, patchJSON, postJSON, deleteJSON } from "@/lib/api-client";
import { exportNotesToPdf, type PdfSection } from "@/lib/export-pdf";
import { extractFlashcards } from "@/lib/flashcards";
import type { NoteDetail } from "@/types/models";
import { createWikiLinkExtension } from "./wiki-link-extension";
import { FlashcardHighlight, FLASHCARD_STUDY_EVENT } from "./flashcard-highlight-extension";
import { ConceptHighlight, CONCEPT_STUDY_EVENT } from "./concept-highlight-extension";
import { Flashcard } from "./flashcard-node";
import { Chart } from "./chart-node";
import { Bookmark } from "./bookmark-node";
import { Callout } from "./callout-node";
import { VideoEmbed } from "./video-embed-node";
import { FileEmbed } from "./file-embed-node";
import { EditorToolbar } from "./toolbar";
import { TableBubbleMenu } from "./table-bubble-menu";
import { NoteTagInput } from "./note-tag-input";
import { NoteTypeSelect } from "./note-type-select";
import { NOTE_TYPE_META, MIN_SYNTHESIS_LENGTH, checkPromotion, type NoteTypeValue } from "@/lib/note-types";
import { extractPlainText, extractLinkedNoteIds } from "@/lib/doc-utils";
import { AttachmentsPanel } from "./attachments-panel";
import { BacklinksPanel } from "./backlinks-panel";
import { NoteTimelinePanel } from "./note-timeline-panel";
import { NoteToc } from "./note-toc";
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

type SaveOpts = { keepalive?: boolean };

function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: [...Args, SaveOpts?]) => void,
  delay: number
) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgs = useRef<Args | null>(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const flush = useCallback((opts?: SaveOpts) => {
    if (timeout.current && pendingArgs.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
      const args = pendingArgs.current;
      pendingArgs.current = null;
      return fnRef.current(...args, opts);
    }
  }, []);

  const debounced = useCallback(
    (...args: Args) => {
      pendingArgs.current = args;
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        pendingArgs.current = null;
        timeout.current = null;
        fnRef.current(...args, undefined);
      }, delay);
    },
    [delay]
  );

  // Se o componente desmontar (ex: saiu da nota) antes do debounce disparar,
  // salva na hora em vez de deixar a última mudança se perder.
  useEffect(() => {
    return flush;
  }, [flush]);

  return [debounced, flush] as const;
}

export function NoteEditor({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const key = `/api/notes/${noteId}`;
  const { data: note, isLoading } = useSWR<NoteDetail>(key, fetcher);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [noteType, setNoteType] = useState<NoteTypeValue>("STIMULUS");
  const [isHub, setIsHub] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [synthesisText, setSynthesisText] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Toda nota abre em modo leitura por padrão — clicar pra editar é a
  // exceção, não o caminho normal de só consultar o que já foi escrito.
  const [readingMode, setReadingMode] = useState(true);
  const [flashcardCount, setFlashcardCount] = useState(0);
  // Direto do conteúdo atual da nota (não da tabela NoteLink, que só fica em
  // dia depois que o conteúdo é salvo) — pra trava de promoção refletir o
  // que está na nota agora, mesmo antes de qualquer save.
  const [outgoingLinksCount, setOutgoingLinksCount] = useState(0);
  const [synthesisDraft, setSynthesisDraft] = useState<string | null>(null);
  const loadedNoteId = useRef<string | null>(null);

  useEffect(() => {
    if (!isFullscreen && !readingMode) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setIsFullscreen(false);
      setReadingMode(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, readingMode]);

  // Disparado pelo ícone de seta no fim de uma linha reconhecida como
  // flashcard (ver flashcard-highlight-extension.ts) — evento simples em
  // vez de prop, porque quem desenha o botão é um plugin do ProseMirror,
  // fora da árvore React.
  useEffect(() => {
    function onStudyFlashcard() {
      router.push(`/flashcards?noteId=${noteId}`);
    }
    window.addEventListener(FLASHCARD_STUDY_EVENT, onStudyFlashcard);
    return () => window.removeEventListener(FLASHCARD_STUDY_EVENT, onStudyFlashcard);
  }, [router, noteId]);

  // Disparado pelo ícone de um conceito reconhecido (ver
  // concept-highlight-extension.ts) — leva pro glossário já com o termo
  // em foco.
  useEffect(() => {
    function onGotoConcept(e: Event) {
      const term = (e as CustomEvent<{ term: string }>).detail?.term;
      router.push(term ? `/conceitos?termo=${encodeURIComponent(term)}` : "/conceitos");
    }
    window.addEventListener(CONCEPT_STUDY_EVENT, onGotoConcept);
    return () => window.removeEventListener(CONCEPT_STUDY_EVENT, onGotoConcept);
  }, [router]);

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
      ConceptHighlight,
      Flashcard,
      Chart,
      // VideoEmbed antes de Bookmark: os dois reagem a uma URL solta
      // colada, e o ProseMirror testa handlePaste na ordem das
      // extensões, parando no primeiro que aceitar — assim vídeo
      // reconhecido (YouTube/Vimeo) sempre ganha de virar bookmark.
      VideoEmbed,
      Bookmark,
      Callout,
      FileEmbed,
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

  // Modo leitura: some com a toolbar/edição, e o editor em si vira só
  // leitura — clicar não abre cursor pra digitar (mas wikilinks/bookmarks
  // continuam clicáveis normalmente).
  useEffect(() => {
    editor?.setEditable(!readingMode);
  }, [editor, readingMode]);

  const saveContent = useCallback(
    async (content: unknown, opts?: SaveOpts) => {
      setSaveState("saving");
      try {
        const updated = await patchJSON<NoteDetail>(key, { content }, opts);
        // Sem isto, o cache do SWR pra esta nota nunca era atualizado depois
        // de salvar — só a lista (/api/notes) era revalidada. Resultado: ao
        // sair da nota e voltar (remonta o componente, key={id} força isso),
        // o useSWR devolvia na hora o snapshot ANTIGO (de antes da edição)
        // que ainda estava em cache, e o guard de "carregar só uma vez por
        // id" nunca deixava o conteúdo salvo de verdade ser aplicado — como
        // se nada tivesse sido salvo, mesmo com o PATCH tendo funcionado.
        if (updated) mutate(key, updated, { revalidate: false });
        setSaveState("saved");
      } catch {
        // Não deixa o indicador preso em "Salvando..." pra sempre — melhor
        // mostrar estado neutro do que mentir sobre o que foi persistido.
        setSaveState("idle");
        toast.error("Erro ao salvar o conteúdo.");
      }
    },
    [key]
  );
  const [debouncedSaveContent, flushSaveContent] = useDebouncedCallback(saveContent, 700);

  const saveTitle = useCallback(
    async (value: string, opts?: SaveOpts) => {
      setSaveState("saving");
      try {
        const updated = await patchJSON<NoteDetail>(key, { title: value }, opts);
        if (updated) mutate(key, updated, { revalidate: false });
        await mutate("/api/notes");
        setSaveState("saved");
      } catch {
        toast.error("Erro ao salvar o título.");
      }
    },
    [key]
  );
  const [debouncedSaveTitle, flushSaveTitle] = useDebouncedCallback(saveTitle, 600);

  // Rede de segurança: o flush normal só roda quando o componente desmonta
  // *dentro do app* (ex: navegou pra outra nota). Fechar a aba, dar reload
  // ou o SO suspender a máquina não passa por aí — o timer do debounce é só
  // destruído, e a última mudança (ainda dentro da janela de 700ms) se
  // perde, mesmo com o rótulo "Salvo" visível de um checkpoint anterior.
  //
  // Duas situações diferentes, dois tratamentos:
  // - visibilitychange (troca de aba, minimizar): a PÁGINA CONTINUA VIVA em
  //   segundo plano, então um fetch comum tem todo o tempo do mundo pra
  //   terminar — sem motivo pra usar keepalive (que tem limite de ~64KB).
  // - pagehide/beforeunload (fechar a aba de verdade, navegar pra fora,
  //   recarregar): a página está sendo destruída NESSE EXATO MOMENTO — um
  //   fetch comum iniciado aqui não tem garantia nenhuma de terminar antes
  //   do navegador matar o processo (é só "melhor esforço", e foi
  //   exatamente esse buraco que deixava o final do texto se perder mesmo
  //   com o flush "funcionando"). keepalive:true entrega o request pro
  //   navegador processar de forma assíncrona, sobrevivendo à página.
  useEffect(() => {
    function flushOnHide() {
      flushSaveTitle();
      flushSaveContent();
    }
    function flushOnUnload() {
      flushSaveTitle({ keepalive: true });
      flushSaveContent({ keepalive: true });
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flushOnHide();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushOnUnload);
    window.addEventListener("beforeunload", flushOnUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushOnUnload);
      window.removeEventListener("beforeunload", flushOnUnload);
    };
  }, [flushSaveTitle, flushSaveContent]);

  // Carrega o conteúdo da nota apenas uma vez por id (evita resetar o cursor a cada revalidação do SWR).
  useEffect(() => {
    if (!note || !editor || loadedNoteId.current === note.id) return;
    loadedNoteId.current = note.id;
    setTitle(note.title);
    setTags(note.tags.map((t) => t.tag.name));
    setNoteType(note.type);
    setIsHub(note.isHub);
    setIsPublished(note.isPublished);
    setShareToken(note.shareToken);
    // Abre em modo leitura por padrão (consultar é o caso comum) — exceto
    // pra uma nota praticamente vazia, recém-criada, onde não faz sentido
    // pedir pra sair do modo leitura só pra começar a escrever o título.
    setReadingMode(note.plainText.trim().length > 0);
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
      const updated = await patchJSON<NoteDetail>(key, { tags: newTags });
      if (updated) mutate(key, updated, { revalidate: false });
      await mutate("/api/tags");
      setSaveState("saved");
    } catch {
      toast.error("Erro ao salvar as tags.");
    }
  }

  // Hub: marcador independente do estágio do pipeline (ver comentário no
  // schema) — notas que linkam pra esta passam a aparecer como
  // "Sub-tópicos" no painel de conexões dela, em vez de "Conexões feitas".
  async function toggleHub() {
    const next = !isHub;
    setIsHub(next);
    try {
      const updated = await patchJSON<NoteDetail>(key, { isHub: next });
      if (updated) mutate(key, updated, { revalidate: false });
      toast.success(next ? "Marcada como Hub." : "Deixou de ser Hub.");
    } catch (err) {
      setIsHub(!next);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  }

  function publicUrl(token: string) {
    return `${window.location.origin}/p/${token}`;
  }

  // Publicar gera o shareToken uma vez (persiste mesmo despublicando
  // depois — republicar devolve o mesmo link, ver PATCH /api/notes/[id]).
  async function setPublished(next: boolean) {
    try {
      const updated = await patchJSON<NoteDetail>(key, { published: next });
      if (updated) {
        mutate(key, updated, { revalidate: false });
        setIsPublished(updated.isPublished);
        setShareToken(updated.shareToken);
        if (next && updated.shareToken) {
          const url = publicUrl(updated.shareToken);
          navigator.clipboard?.writeText(url).catch(() => {});
          toast.success("Nota publicada — link copiado.", { description: url });
        } else {
          toast.success("Nota despublicada — o link parou de funcionar.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  }

  function copyPublicLink() {
    if (!shareToken) return;
    const url = publicUrl(shareToken);
    navigator.clipboard?.writeText(url).catch(() => {});
    toast.success("Link copiado.", { description: url });
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
      const updated = await patchJSON<NoteDetail>(key, {
        type: newType,
        ...(newSynthesisText !== undefined ? { synthesisText: newSynthesisText } : {}),
      });
      if (updated) mutate(key, updated, { revalidate: false });
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

  // Fluxo de extração (Sessão/Córtex → Estímulo): pega o trecho selecionado
  // na nota diária, vira uma nota Estímulo nova, e deixa um link no lugar —
  // processar a sessão bruta em fragmentos endereçáveis, sem reescrever nada.
  async function extractSelectionToStimulus() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
    if (!selectedText) {
      toast.error("Selecione um trecho de texto na sessão pra extrair.");
      return;
    }
    const newTitle = selectedText.length > 60 ? `${selectedText.slice(0, 60)}…` : selectedText;
    try {
      const created = await postJSON<{ id: string; title: string }>("/api/notes", {
        type: "STIMULUS",
        title: newTitle,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: selectedText }] },
            {
              // Referencia de volta a sessão de onde veio — pra não perder
              // o rastro do contexto original quando processado depois.
              type: "paragraph",
              content: [
                { type: "text", text: "Vindo de: " },
                { type: "wikiLink", attrs: { noteId, label: title || "Sessão" } },
              ],
            },
          ],
        },
      });
      editor.chain().focus().insertWikiLink({ noteId: created.id, label: created.title }).run();
      // A nota nova já nasce referenciando esta (sincronizado no POST acima),
      // mas o link de volta (esta → nota nova) só existe depois que ESTE
      // conteúdo for salvo — sem forçar aqui, ficava esperando os 700ms do
      // debounce (ou nem persistia, se a aba fosse fechada antes disso), daí
      // a sensação de "aparece quando quer" nas Conexões feitas. E o painel
      // de backlinks tem seu próprio cache (SWR) — sem revalidar na mão ele
      // só atualizaria sozinho no próximo refoco da janela.
      await flushSaveContent();
      await Promise.all([mutate("/api/notes"), mutate(`/api/notes/${noteId}/backlinks`)]);
      toast.success(`Estímulo criado: "${created.title}"`, {
        action: { label: "Abrir", onClick: () => router.push(`/notes/${created.id}`) },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao extrair o trecho.");
    }
  }

  async function removeNote() {
    // Soft delete — a nota vai pra lixeira, não é apagada na hora (ver
    // DELETE /api/notes/[id] e /trash). Por isso a confirmação é mais leve
    // do que a de uma exclusão de vez.
    const ok = await confirm({
      title: "Mover esta nota pra lixeira?",
      description: "Fica lá por 30 dias — dá pra restaurar a qualquer momento antes disso.",
      confirmLabel: "Mover pra lixeira",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(key);
      await mutate("/api/notes");
      toast.success("Nota movida pra lixeira.");
      router.push("/notes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir a nota.");
    }
  }

  async function restoreNote() {
    try {
      const updated = await postJSON<NoteDetail>(`/api/notes/${noteId}/restore`, {});
      mutate(key, updated, { revalidate: false });
      await mutate("/api/notes");
      toast.success("Nota restaurada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao restaurar a nota.");
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
      <NoteToc editor={editor} />
      <NoteTimelinePanel entries={note.stageHistory} extensions={extensions} noteTitle={title} />
      <div
        className={cn(
          "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8",
          isFullscreen && "max-w-4xl"
        )}
      >
        {note.deletedAt && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <span className="text-destructive">Esta nota está na lixeira — vai ser apagada de vez em breve.</span>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={restoreNote}>
              Restaurar
            </Button>
          </div>
        )}

        <div className="mb-3 flex items-start justify-between gap-4">
          <input
            value={title}
            readOnly={readingMode}
            onChange={(e) => {
              setTitle(e.target.value);
              debouncedSaveTitle(e.target.value);
            }}
            placeholder="Nota sem título"
            className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-3xl"
          />
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {readingMode ? "" : saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : ""}
            </span>
            <Button
              type="button"
              variant={readingMode ? "default" : "ghost"}
              size="icon"
              className="size-8"
              title={readingMode ? "Sair do modo leitura (Esc)" : "Modo leitura"}
              onClick={() => setReadingMode((v) => !v)}
            >
              {readingMode ? <PenLine className="size-4" /> : <BookOpen className="size-4" />}
            </Button>
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
                {isPublished ? (
                  <>
                    <DropdownMenuItem onClick={copyPublicLink}>
                      <Copy /> Copiar link público
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPublished(false)}>
                      <EyeOff /> Despublicar
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => setPublished(true)}>
                    <Globe /> Publicar como página
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={removeNote}>
                  <Trash2 /> Excluir nota
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {readingMode ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {(() => {
              const meta = NOTE_TYPE_META[noteType];
              const Icon = meta.icon;
              return (
                <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                  <Icon className="size-3.5" /> {meta.label}
                </span>
              );
            })()}
            {isHub && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-chart-2/40 px-2 py-1 text-xs text-chart-2">
                <Landmark className="size-3.5" /> Hub
              </span>
            )}
            {isPublished && (
              <button
                type="button"
                onClick={copyPublicLink}
                title="Copiar link público"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10"
              >
                <Globe className="size-3.5" /> Pública
              </button>
            )}
            {tags.map((t) => (
              <span key={t} className="rounded-md border px-2 py-1 text-xs">
                #{t}
              </span>
            ))}
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            {note.dailyDate ? (
              // Córtex não é um estágio do pipeline — não faz sentido oferecer
              // o seletor de tipo aqui (qualquer promoção direta seria
              // recusada pela trava "não dá pra pular estágio"). Só vira
              // Estímulo de verdade via "Extrair pra Estímulo" abaixo.
              <span
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground"
                title="Rascunho de sessão — fora do pipeline de promoção"
              >
                <Brain className="size-3.5" /> Córtex
              </span>
            ) : (
              <NoteTypeSelect value={noteType} onChange={requestNoteTypeChange} />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleHub}
              title="Notas que linkam pra esta passam a aparecer como sub-tópicos dela"
              className={cn("h-7 gap-1.5 text-xs", isHub && "border-chart-2/50 text-chart-2 hover:text-chart-2")}
            >
              <Landmark className="size-3.5" /> {isHub ? "Hub" : "Marcar como Hub"}
            </Button>
            <NoteTagInput value={tags} onChange={updateTags} />
            {note.dailyDate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                title="Selecione um trecho no texto e clique aqui pra virar uma nota Estímulo"
                onClick={extractSelectionToStimulus}
              >
                <Scissors className="size-3.5" /> Extrair pra Estímulo
              </Button>
            )}
          </div>
        )}

        <div className={cn("rounded-lg", !readingMode && "border")}>
          {!readingMode && (
            <>
              <EditorToolbar editor={editor} noteId={noteId} />
              <TableBubbleMenu editor={editor} />
            </>
          )}
          <EditorContent editor={editor} />
          {!readingMode && flashcardCount > 0 && (
            <button
              type="button"
              onClick={() => router.push(`/flashcards?noteId=${noteId}`)}
              className="flex w-full items-center gap-1.5 border-t px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              title="Estudar os flashcards desta nota"
            >
              <Layers className="size-3.5 text-primary" />
              {flashcardCount} {flashcardCount === 1 ? "flashcard" : "flashcards"} nesta nota
            </button>
          )}
        </div>

        {!isFullscreen && (
          <div className="mt-6 space-y-6">
            <AttachmentsPanel noteId={noteId} />
            <BacklinksPanel noteId={noteId} isHub={isHub} />
          </div>
        )}
      </div>
      {ConfirmDialog}

      <Dialog
        open={synthesisDraft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSynthesisDraft(null);
          }
        }}
      >
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
            <Button
              variant="outline"
              onClick={() => {
                setSynthesisDraft(null);
              }}
            >
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
