import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { REVIEW_GRADES, nextReviewState, dueAtFromInterval, type ReviewGrade } from "@/lib/spaced-repetition";

/**
 * Registra a avaliação de um versículo (Errei/Difícil/Fácil) e agenda a
 * próxima revisão — mesmo motor de repetição espaçada dos flashcards do
 * Conhecimento, só que o estado mora direto no MemoryVerse.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : null;
    const grade: ReviewGrade | null = REVIEW_GRADES.includes(body.grade) ? body.grade : null;
    if (!id || !grade) return jsonError("Dados inválidos.");

    const existing = await prisma.memoryVerse.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return jsonError("Versículo não encontrado.", 404);

    const state = nextReviewState(existing, grade);
    const dueAt = dueAtFromInterval(state.intervalDays);

    const verse = await prisma.memoryVerse.update({
      where: { id },
      data: { ...state, dueAt, lastReviewedAt: new Date() },
    });

    return NextResponse.json(verse);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
