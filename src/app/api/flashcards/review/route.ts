import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import {
  REVIEW_GRADES,
  INITIAL_REVIEW_STATE,
  nextReviewState,
  dueAtFromInterval,
  type ReviewGrade,
} from "@/lib/spaced-repetition";

/** Registra a avaliação de um flashcard (Errei/Difícil/Fácil) e agenda a próxima revisão. */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const noteId = typeof body.noteId === "string" ? body.noteId : null;
    const cardKey = typeof body.cardKey === "string" ? body.cardKey : null;
    const grade: ReviewGrade | null = REVIEW_GRADES.includes(body.grade) ? body.grade : null;

    if (!noteId || !cardKey || !grade) {
      return jsonError("Dados inválidos.", 400);
    }

    const note = await prisma.note.findUnique({ where: { id: noteId }, select: { userId: true } });
    if (!note || note.userId !== userId) return jsonError("Nota não encontrada.", 404);

    const existing = await prisma.flashcardReview.findUnique({
      where: { noteId_cardKey: { noteId, cardKey } },
    });

    const state = nextReviewState(existing ?? INITIAL_REVIEW_STATE, grade);
    const dueAt = dueAtFromInterval(state.intervalDays);
    const lastReviewedAt = new Date();

    const review = await prisma.flashcardReview.upsert({
      where: { noteId_cardKey: { noteId, cardKey } },
      create: { userId, noteId, cardKey, ...state, dueAt, lastReviewedAt },
      update: { ...state, dueAt, lastReviewedAt },
    });

    return NextResponse.json(review);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
