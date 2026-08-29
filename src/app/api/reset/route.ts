import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/**
 * Zera a conta do usuário: apaga TODAS as notas (e o que pende delas —
 * tags, links, anexos, revisões de flashcard, via cascade). A conta
 * (login/senha) continua intacta. Ação irreversível — só chamada a partir
 * de um clique explícito do próprio usuário, atrás de uma confirmação forte
 * na UI (não é algo que o Claude decide disparar sozinho).
 */
export async function POST() {
  try {
    const userId = await requireUserId();

    await prisma.$transaction([
      prisma.note.deleteMany({ where: { userId } }),
      prisma.tag.deleteMany({ where: { userId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
