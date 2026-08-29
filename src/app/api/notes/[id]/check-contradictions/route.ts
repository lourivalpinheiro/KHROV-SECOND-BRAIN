import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { extractLinkedNoteIds, type TiptapDoc } from "@/lib/doc-utils";
import { aiEnabled, checkContradiction, type ContradictionResult } from "@/lib/ai-note-checks";

/**
 * Sob demanda (botão), compara a síntese desta nota com a de cada nota
 * linkada que também já tem síntese própria, e devolve os pares que a IA
 * apontou como contraditórios. Não roda sozinho, não bloqueia nada.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    if (!aiEnabled()) return jsonError("Verificação por IA não está configurada.", 503);

    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== userId) return jsonError("Nota não encontrada.", 404);
    if (!note.synthesisText?.trim()) {
      return jsonError("Esta nota ainda não tem uma síntese pra comparar.", 400);
    }

    const linkedIds = extractLinkedNoteIds(note.content as TiptapDoc).filter((linkedId) => linkedId !== id);
    if (linkedIds.length === 0) return NextResponse.json({ contradictions: [] as ContradictionResult[] });

    const linked = await prisma.note.findMany({
      where: { id: { in: linkedIds }, userId, synthesisText: { not: null } },
      select: { id: true, title: true, synthesisText: true },
    });

    const results = await Promise.all(
      linked.map(async (target) => {
        if (!target.synthesisText?.trim()) return null;
        const result = await checkContradiction(note.synthesisText!, target.title, target.synthesisText);
        if (!result?.contradicts) return null;
        return {
          noteId: target.id,
          title: target.title,
          reason: result.reason ?? "Parecem se contradizer.",
        } satisfies ContradictionResult;
      })
    );

    return NextResponse.json({ contradictions: results.filter((r): r is ContradictionResult => r !== null) });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
