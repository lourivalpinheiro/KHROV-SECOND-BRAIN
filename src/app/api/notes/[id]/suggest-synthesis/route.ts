import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { extractLinkedNoteIds, extractPlainText, type TiptapDoc } from "@/lib/doc-utils";
import { aiEnabled, suggestSynthesis } from "@/lib/ai-note-checks";

/** Gera um rascunho de síntese (Potenciação→Sinapse) via IA. Só um ponto de partida — o usuário edita antes de promover. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    if (!aiEnabled()) return jsonError("Sugestão por IA não está configurada.", 503);

    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== userId) return jsonError("Nota não encontrada.", 404);

    const doc = note.content as TiptapDoc;
    const currentText = note.plainText || extractPlainText(doc);
    const linkedIds = extractLinkedNoteIds(doc).filter((linkedId) => linkedId !== id);

    const linked = linkedIds.length
      ? await prisma.note.findMany({
          where: { id: { in: linkedIds }, userId },
          select: { title: true, plainText: true },
        })
      : [];

    const suggestion = await suggestSynthesis(currentText, linked);
    if (!suggestion) return jsonError("A IA não conseguiu gerar uma sugestão agora — tente escrever direto.", 503);

    return NextResponse.json({ suggestion });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
