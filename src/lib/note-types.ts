import { Zap, FlaskConical, Gem, Fingerprint, type LucideIcon } from "lucide-react";

/**
 * Pipeline de maturação cognitiva da nota, inspirado em neurobiologia do
 * aprendizado: nasce como Estímulo (captura crua) e é "promovida" — cada
 * salto exige um esforço específico do usuário (trava de fricção
 * intencional), não é só arrastar.
 */
export const NOTE_TYPES = ["STIMULUS", "POTENTIATION", "SYNAPSE", "ENGRAM"] as const;

export type NoteTypeValue = (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_META: Record<
  NoteTypeValue,
  { label: string; description: string; icon: LucideIcon }
> = {
  STIMULUS: {
    label: "Estímulo",
    description: "Captura crua e rápida — o dado bruto, ainda não processado.",
    icon: Zap,
  },
  POTENTIATION: {
    label: "Potenciação",
    description: "Laboratório de maturação — cruza referências, aprofunda com suas palavras.",
    icon: FlaskConical,
  },
  SYNAPSE: {
    label: "Sinapse",
    description: "Domínio lógico — o conceito consolidado, numa base autônoma.",
    icon: Gem,
  },
  ENGRAM: {
    label: "Engrama",
    description: "Consolidação e expressão — validado pela prática ativa (flashcards).",
    icon: Fingerprint,
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

/** Tamanho mínimo (em caracteres) da síntese exigida pra promover a Sinapse. */
export const MIN_SYNTHESIS_LENGTH = 140;

export type PromotionStats = {
  /** Quantas outras notas esta nota referencia (wikilinks de saída). */
  outgoingLinksCount: number;
  /** Texto da síntese (premissa fundamental, com as palavras do usuário). */
  synthesisText: string | null;
  /** Quantos flashcards existem no conteúdo desta nota. */
  flashcardCount: number;
  /** Texto puro do conteúdo da nota, pra checar cópia direta na síntese. */
  plainText: string;
};

export type PromotionCheck = { ok: true } | { ok: false; reason: string };

/**
 * Trava de fricção intencional pra cada salto do pipeline. Só valida o
 * PRÓXIMO passo (fromIdx+1) — promoção pula estágio é sempre bloqueada.
 * Regressão (voltar um estágio) nunca é bloqueada.
 */
export function checkPromotion(
  from: NoteTypeValue,
  to: NoteTypeValue,
  stats: PromotionStats
): PromotionCheck {
  const fromIdx = NOTE_TYPES.indexOf(from);
  const toIdx = NOTE_TYPES.indexOf(to);

  if (toIdx <= fromIdx) return { ok: true };
  if (toIdx > fromIdx + 1) {
    return { ok: false, reason: "Promova um estágio de cada vez — não dá pra pular." };
  }

  if (from === "STIMULUS" && to === "POTENTIATION") {
    if (stats.outgoingLinksCount < 1) {
      return {
        ok: false,
        reason:
          "Adicione pelo menos uma referência cruzada (link [[ pra outra nota) antes de promover pra Potenciação.",
      };
    }
  }

  if (from === "POTENTIATION" && to === "SYNAPSE") {
    const text = (stats.synthesisText ?? "").trim();
    if (text.length < MIN_SYNTHESIS_LENGTH) {
      return {
        ok: false,
        reason: `Escreva a premissa fundamental com suas próprias palavras (mínimo ${MIN_SYNTHESIS_LENGTH} caracteres) antes de promover.`,
      };
    }
    if (text.length > 20 && stats.plainText.toLowerCase().includes(text.toLowerCase())) {
      return {
        ok: false,
        reason: "Esse texto parece cópia direta do conteúdo da nota — reescreva com suas próprias palavras.",
      };
    }
  }

  if (from === "SYNAPSE" && to === "ENGRAM") {
    if (stats.flashcardCount < 1) {
      return {
        ok: false,
        reason: "Crie pelo menos um flashcard de evocação nesta nota antes de promover a Engrama.",
      };
    }
  }

  return { ok: true };
}
