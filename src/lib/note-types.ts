import { Brain, Zap, FlaskConical, Share2, Fingerprint, type LucideIcon } from "lucide-react";

/**
 * Pipeline de maturação cognitiva da nota, inspirado em neurobiologia do
 * aprendizado: nasce como Estímulo (captura crua) e é "promovida" — cada
 * salto exige um esforço específico do usuário (trava de fricção
 * intencional), não é só arrastar.
 *
 * Córtex (rascunho de sessão) fica DE FORA desse array de propósito — não
 * é um estágio do pipeline, é o que vem antes dele. Só vira Estímulo de
 * verdade quando um trecho é extraído pra uma nota nova (ver
 * "Extrair pra Estímulo" no editor); a nota de Córtex em si nunca é
 * promovida.
 */
export const NOTE_TYPES = ["STIMULUS", "POTENTIATION", "SYNAPSE", "ENGRAM"] as const;

export type NoteTypeValue = "CORTEX" | (typeof NOTE_TYPES)[number];

export const NOTE_TYPE_META: Record<
  NoteTypeValue,
  { label: string; description: string; icon: LucideIcon }
> = {
  CORTEX: {
    label: "Córtex",
    description: "Rascunho de sessão — ainda não processado, fora do pipeline.",
    icon: Brain,
  },
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
    icon: Share2,
  },
  ENGRAM: {
    label: "Engrama",
    description: "Consolidação e expressão — validado pela prática ativa (flashcards).",
    icon: Fingerprint,
  },
};

const ALL_NOTE_TYPES: readonly string[] = ["CORTEX", ...NOTE_TYPES];

export function isNoteType(value: unknown): value is NoteTypeValue {
  return typeof value === "string" && ALL_NOTE_TYPES.includes(value);
}

// Amplia pra string só pro indexOf aceitar qualquer NoteTypeValue (inclusive
// "CORTEX", que corretamente não é encontrado — retorna -1, fora do pipeline).
const PIPELINE_TYPES: readonly string[] = NOTE_TYPES;

/** Índice do estágio na pipeline (0=Estímulo..3=Engrama), ou -1 se fora dela (Córtex). Usado pra distinguir promoção pra frente de regressão — ex: linha do tempo em NoteStageHistory. */
export function pipelineIndex(type: NoteTypeValue): number {
  return PIPELINE_TYPES.indexOf(type);
}

/** Próximo estágio na hierarquia, ou null se a nota já está no estágio final (ou fora do pipeline, ex: Córtex). */
export function nextNoteType(type: NoteTypeValue): NoteTypeValue | null {
  const idx = PIPELINE_TYPES.indexOf(type);
  if (idx === -1) return null;
  return idx < NOTE_TYPES.length - 1 ? NOTE_TYPES[idx + 1] : null;
}

/** Tamanho mínimo (em caracteres) da síntese exigida pra promover a Sinapse. */
export const MIN_SYNTHESIS_LENGTH = 140;

export type PromotionStats = {
  /**
   * Pelo menos uma nota referenciada (wikilink de saída) já tem conteúdo
   * escrito, ou está em estágio avançado (Sinapse/Engrama) — filtro
   * anti-lixo: sem isso, dava pra digitar `[[teste]]`, criar uma nota vazia
   * na hora e destravar sem cumprir o espírito da trava.
   */
  hasValidOutgoingLink: boolean;
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
  const fromIdx = PIPELINE_TYPES.indexOf(from);
  const toIdx = PIPELINE_TYPES.indexOf(to);

  if (toIdx <= fromIdx) return { ok: true };
  if (toIdx > fromIdx + 1) {
    return { ok: false, reason: "Promova um estágio de cada vez — não dá pra pular." };
  }

  if (from === "STIMULUS" && to === "POTENTIATION") {
    if (!stats.hasValidOutgoingLink) {
      return {
        ok: false,
        reason:
          "Adicione um link [[ pra uma nota que já tenha conteúdo (ou esteja em Sinapse/Engrama) — linkar pra uma nota vazia só pra destravar não conta.",
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
