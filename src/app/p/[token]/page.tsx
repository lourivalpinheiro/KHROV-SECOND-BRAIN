"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
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
import TextAlign from "@tiptap/extension-text-align";
import { BrainCircuit, FileQuestion, User } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { createWikiLinkExtension } from "@/components/editor/wiki-link-extension";
import { Flashcard } from "@/components/editor/flashcard-node";
import { Chart } from "@/components/editor/chart-node";
import { Bookmark } from "@/components/editor/bookmark-node";
import { Callout } from "@/components/editor/callout-node";
import { VideoEmbed } from "@/components/editor/video-embed-node";
import { FileEmbed } from "@/components/editor/file-embed-node";

type PublicNote = {
  title: string;
  content: unknown;
  updatedAt: string;
  authorName: string;
};

// Mesmo conjunto de extensões do editor de verdade (menos as só-de-edição
// como highlight de flashcard/conceito, que são plugins do ProseMirror
// sem efeito nenhum sobre generateHTML — só schema importa aqui). Roda
// no navegador de propósito (não em Server Component): Chart usa
// DOMParser internamente pro SVG estático, que só existe no browser.
const PUBLIC_NOTE_EXTENSIONS = [
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
  createWikiLinkExtension(),
  Flashcard,
  Chart,
  Bookmark,
  Callout,
  VideoEmbed,
  FileEmbed,
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Página pública de uma nota (sem login) — /p/[shareToken]. Servida só
 * quando a nota está isPublished (ver /api/public/notes/[token]).
 * Renderiza o conteúdo por generateHTML (client-side, ver comentário
 * acima) igual ao export de PDF — mesma fidelidade visual, num layout
 * próprio, sem sidebar nem nada de edição.
 */
export default function PublicNotePage() {
  const { token } = useParams<{ token: string }>();
  const { data: note, error, isLoading } = useSWR<PublicNote>(`/api/public/notes/${token}`, fetcher);

  const html = useMemo(() => {
    if (!note?.content) return "";
    try {
      return generateHTML(note.content as never, PUBLIC_NOTE_EXTENSIONS);
    } catch {
      return "<p>Não foi possível exibir o conteúdo desta nota.</p>";
    }
  }, [note?.content]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (error || !note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
        <FileQuestion className="size-10" />
        <p className="text-lg font-medium text-foreground">Página não encontrada</p>
        <p className="max-w-sm text-sm">Esse link não existe mais, ou a nota foi despublicada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <BrainCircuit className="size-3.5" /> Khrov
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">{note.title || "Nota sem título"}</h1>
        <div className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="size-3.5" /> {note.authorName}
          <span className="text-muted-foreground/50">·</span>
          <span>Atualizado em {formatDate(note.updatedAt)}</span>
        </div>
        <div
          className="prose prose-neutral dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
    </div>
  );
}
