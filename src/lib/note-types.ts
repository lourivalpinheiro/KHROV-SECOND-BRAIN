import { Lightbulb, BookOpen, Gem, type LucideIcon } from "lucide-react";

/**
 * Estágios de maturidade da nota, inspirados no método Zettelkasten:
 * a nota nasce como captura rápida (Insight) e vai sendo "promovida" — de
 * algo ancorado numa fonte externa (Nota de leitura) até uma ideia atômica,
 * já em palavras próprias e conectada a outras (Nota permanente).
 */
export const NOTE_TYPES = ["FLEETING", "LITERATURE", "PERMANENT"] as const;

export type NoteTypeValue = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_META: Record<
  NoteTypeValue,
  { label: string; description: string; icon: LucideIcon }
> = {
  FLEETING: {
    label: "Insights",
    description: "Captura rápida, ainda crua — o primeiro registro de um pensamento.",
    icon: Lightbulb,
  },
  LITERATURE: {
    label: "Notas de leitura",
    description: "Anotação sobre algo que você leu, assistiu ou ouviu, já com suas palavras.",
    icon: BookOpen,
  },
  PERMANENT: {
    label: "Notas permanentes",
    description: "Ideia madura, atômica e conectada a outras notas.",
    icon: Gem,
  },
};

export function isNoteType(value: unknown): value is NoteTypeValue {
  return typeof value === "string" && (NOTE_TYPES as readonly string[]).includes(value);
}

/** Próximo estágio na hierarquia, ou null se a nota já está no estágio final. */
export function nextNoteType(type: NoteTypeValue): NoteTypeValue | null {
  const idx = NOTE_TYPES.indexOf(type);
  return idx < NOTE_TYPES.length - 1 ? NOTE_TYPES[idx + 1] : null;
}
