"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { ArrowLeft, BookOpen, Layers, PenLine, Trash2 } from "lucide-react";
import { fetcher, patchJSON, deleteJSON } from "@/lib/api-client";
import { SermonToolbar } from "./sermon-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SERMON_STATUS_LABELS } from "@/lib/spiritual";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SermonStatus = "DRAFT" | "READY" | "PREACHED";
type Sermon = {
  id: string;
  title: string;
  passage: string | null;
  status: SermonStatus;
  date: string | null;
  content: unknown;
  seriesId: string | null;
  series: { id: string; title: string } | null;
};
type Series = { id: string; title: string };

const NO_SERIES = "__none__";

function useDebouncedCallback<Args extends unknown[]>(fn: (...args: Args) => void, delay: number) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const debounced = useCallback(
    (...args: Args) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  );
  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    []
  );
  return debounced;
}

/**
 * Editor de sermão — leve de propósito (ver comparação com o Conhecimento
 * na sessão que definiu isso): título, passagem, status, data e série são
 * campos próprios; o corpo é um Tiptap simples (sem wikilink/flashcard/
 * grafo) com modo leitura, pra pregar direto da tela sem a barra de
 * ferramentas no caminho.
 */
export function SermonEditor({ sermonId }: { sermonId: string }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const key = `/api/spiritual/sermons/${sermonId}`;
  const { data: sermon, isLoading } = useSWR<Sermon>(key, fetcher);
  const { data: series } = useSWR<Series[]>("/api/spiritual/sermon-series", fetcher);

  const [title, setTitle] = useState("");
  const [passage, setPassage] = useState("");
  const [status, setStatus] = useState<SermonStatus>("DRAFT");
  const [date, setDate] = useState("");
  const [seriesId, setSeriesId] = useState(NO_SERIES);
  const [readingMode, setReadingMode] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const loadedId = useRef<string | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TiptapLink.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Escreva o sermão..." }),
    ],
    []
  );

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-neutral dark:prose-invert max-w-none min-h-[50vh] focus:outline-none px-3 py-4",
      },
    },
    onUpdate: ({ editor }) => {
      debouncedSaveContent(editor.getJSON());
    },
  });

  useEffect(() => {
    editor?.setEditable(!readingMode);
  }, [editor, readingMode]);

  const saveField = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaveState("saving");
      try {
        const updated = await patchJSON<Sermon>(key, patch);
        if (updated) mutate(key, updated, { revalidate: false });
        await mutate("/api/spiritual/sermons");
        setSaveState("saved");
      } catch (err) {
        setSaveState("idle");
        toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    },
    [key]
  );

  const debouncedSaveContent = useDebouncedCallback((content: unknown) => saveField({ content }), 700);
  const debouncedSaveTitle = useDebouncedCallback((v: string) => saveField({ title: v }), 600);
  const debouncedSavePassage = useDebouncedCallback((v: string) => saveField({ passage: v }), 600);

  useEffect(() => {
    if (!sermon || !editor || loadedId.current === sermon.id) return;
    loadedId.current = sermon.id;
    setTitle(sermon.title);
    setPassage(sermon.passage ?? "");
    setStatus(sermon.status);
    setDate(sermon.date ?? "");
    setSeriesId(sermon.seriesId ?? NO_SERIES);
    queueMicrotask(() => {
      if (!editor.isDestroyed) editor.commands.setContent(sermon.content ?? { type: "doc", content: [{ type: "paragraph" }] });
    });
  }, [sermon, editor]);

  async function removeSermon() {
    const ok = await confirm({
      title: `Excluir o sermão "${sermon?.title}"?`,
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir sermão",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(key);
      await mutate("/api/spiritual/sermons");
      toast.success("Sermão excluído.");
      router.push("/espiritual/sermoes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  if (isLoading || !sermon) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Carregando sermão...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" render={<NextLink href="/espiritual/sermoes" />}>
            <ArrowLeft className="size-3.5" /> Sermões
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : ""}
            </span>
            <Button
              type="button"
              variant={readingMode ? "default" : "ghost"}
              size="icon"
              className="size-8"
              title={readingMode ? "Sair do modo leitura" : "Modo leitura"}
              onClick={() => setReadingMode((v) => !v)}
            >
              {readingMode ? <PenLine className="size-4" /> : <BookOpen className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={removeSermon}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <input
          value={title}
          readOnly={readingMode}
          onChange={(e) => {
            setTitle(e.target.value);
            debouncedSaveTitle(e.target.value);
          }}
          placeholder="Título do sermão"
          className="mb-3 w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-3xl"
        />

        {readingMode ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {passage && <span className="rounded-md border px-2 py-1 text-xs font-medium text-primary">{passage}</span>}
            <span className="rounded-md border px-2 py-1 text-xs">{SERMON_STATUS_LABELS[status]}</span>
            {sermon.series && (
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                <Layers className="size-3 text-primary" /> {sermon.series.title}
              </span>
            )}
          </div>
        ) : (
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Passagem</Label>
              <Input
                value={passage}
                onChange={(e) => {
                  setPassage(e.target.value);
                  debouncedSavePassage(e.target.value);
                }}
                placeholder="Ex: Romanos 8:28-30"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => { const val = (v as SermonStatus) ?? "DRAFT"; setStatus(val); saveField({ status: val }); }}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>{() => SERMON_STATUS_LABELS[status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERMON_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); saveField({ date: e.target.value || null }); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Série</Label>
              <Select
                value={seriesId}
                onValueChange={(v) => {
                  const val = v ?? NO_SERIES;
                  setSeriesId(val);
                  saveField({ seriesId: val === NO_SERIES ? null : val });
                }}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>{() => (seriesId === NO_SERIES ? "Sem série" : series?.find((s) => s.id === seriesId)?.title ?? "Sem série")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SERIES}>Sem série</SelectItem>
                  {(series ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className={cn("rounded-lg", !readingMode && "border")}>
          {!readingMode && <SermonToolbar editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
