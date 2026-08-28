/**
 * Repetição espaçada (variação simplificada do SM-2, usado pelo Anki):
 * em vez da escala 0-5 original, expõe só 3 graus — Errei / Difícil / Fácil
 * — que é o que faz sentido revisar num flashcard de nota pessoal.
 */
export type ReviewGrade = "AGAIN" | "HARD" | "EASY";

export const REVIEW_GRADES: ReviewGrade[] = ["AGAIN", "HARD", "EASY"];

export type ReviewState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
};

export const INITIAL_REVIEW_STATE: ReviewState = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
};

const MIN_EASE = 1.3;

export function nextReviewState(state: ReviewState, grade: ReviewGrade): ReviewState {
  const { easeFactor, intervalDays } = state;

  if (grade === "AGAIN") {
    // Errou: reinicia a contagem de repetições e volta a revisar amanhã.
    return { easeFactor: Math.max(MIN_EASE, easeFactor - 0.2), intervalDays: 1, repetitions: 0 };
  }

  const repetitions = state.repetitions + 1;
  let interval: number;
  if (repetitions === 1) {
    interval = grade === "HARD" ? 1 : 3;
  } else if (repetitions === 2) {
    interval = grade === "HARD" ? 3 : 6;
  } else {
    const multiplier = grade === "HARD" ? Math.max(1.2, easeFactor - 0.3) : easeFactor;
    interval = Math.round(intervalDays * multiplier);
  }

  const nextEase = grade === "HARD" ? Math.max(MIN_EASE, easeFactor - 0.15) : easeFactor + 0.1;

  return { easeFactor: nextEase, intervalDays: Math.max(1, interval), repetitions };
}

export function dueAtFromInterval(intervalDays: number, from: Date = new Date()): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + intervalDays);
  return due;
}

export function isDue(dueAt: string | null, now: Date = new Date()): boolean {
  // Nunca revisado = já está devido.
  if (!dueAt) return true;
  return new Date(dueAt).getTime() <= now.getTime();
}
