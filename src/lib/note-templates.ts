import { BookOpen, FileText, UserRound, type LucideIcon } from "lucide-react";
import { EMPTY_DOC, type TiptapDoc } from "@/lib/doc-utils";

function heading(text: string) {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}

const paragraph = { type: "paragraph" };

export type NoteTemplateKey = "blank" | "book" | "person";

export type NoteTemplate = {
  key: NoteTemplateKey;
  label: string;
  icon: LucideIcon;
  content: TiptapDoc;
};

/**
 * Estruturas de partida pra "Nova nota" — puramente um atalho de digitação
 * (títulos de seção já no lugar), não uma trava nem um tipo de nota à
 * parte. Baseado no padrão que já aparece nas notas reais (nota de livro
 * e de pessoa sempre com Introdução/Desenvolvimento). "Em branco" continua
 * sendo o padrão em todo lugar que cria nota sem pedir escolha (sidebar,
 * Cmd+K) — só a página /notes oferece a escolha explícita.
 */
export const NOTE_TEMPLATES: NoteTemplate[] = [
  { key: "blank", label: "Em branco", icon: FileText, content: EMPTY_DOC },
  {
    key: "book",
    label: "Nota de livro",
    icon: BookOpen,
    content: { type: "doc", content: [heading("Introdução"), paragraph, heading("Desenvolvimento"), paragraph] },
  },
  {
    key: "person",
    label: "Nota de pessoa",
    icon: UserRound,
    content: {
      type: "doc",
      content: [heading("Quem é"), paragraph, heading("Por que é relevante"), paragraph],
    },
  },
];

export function noteTemplate(key: NoteTemplateKey | undefined): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.key === key) ?? NOTE_TEMPLATES[0];
}
