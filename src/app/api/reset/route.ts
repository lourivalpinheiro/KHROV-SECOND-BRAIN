import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { ensureParaFolders } from "@/lib/folders-service";

/**
 * Zera a conta do usuário: apaga TODAS as notas (e o que pende delas —
 * tags, links, anexos, revisões de flashcard, via cascade) e TODAS as
 * pastas. A conta (login/senha) continua intacta. Ação irreversível — só
 * chamada a partir de um clique explícito do próprio usuário, atrás de uma
 * confirmação forte na UI (não é algo que o Claude decide disparar sozinho).
 * Recria as 4 pastas-raiz do PARA em seguida, pra deixar uma base pronta.
 */
export async function POST() {
  try {
    const userId = await requireUserId();

    await prisma.$transaction([
      prisma.note.deleteMany({ where: { userId } }),
      prisma.folder.deleteMany({ where: { userId } }),
      prisma.tag.deleteMany({ where: { userId } }),
    ]);

    await ensureParaFolders(userId);

    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
