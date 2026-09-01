import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/**
 * Notas sem NENHUMA conexão — nem link de saída, nem de entrada — em
 * qualquer estágio (diferente de "Estímulo vazio", que é sobre conteúdo
 * curto, não sobre estar desconectada; ver src/lib/note-health.ts). Fora
 * da lixeira e do Córtex (rascunho de sessão, não faz parte do grafo).
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const notes = await prisma.note.findMany({
      where: {
        userId,
        deletedAt: null,
        type: { not: "CORTEX" },
        linksOut: { none: {} },
        linksIn: { none: {} },
      },
      select: { id: true, title: true, type: true, plainText: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
    });

    return NextResponse.json(notes);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
