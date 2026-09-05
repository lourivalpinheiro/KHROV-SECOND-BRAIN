import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

/** Registra a metadata do anexo após o upload direto pro Supabase Storage ter sido concluído no cliente. */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const { noteId, filename, storageKey, mimeType, size } = body as {
      noteId?: string;
      filename?: string;
      storageKey?: string;
      mimeType?: string;
      size?: number;
    };

    if (!noteId || !filename || !storageKey || !mimeType || typeof size !== "number") {
      return jsonError("Dados de anexo incompletos.");
    }

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note || note.userId !== userId) return jsonError("Nota não encontrada.", 404);

    const attachment = await prisma.attachment.create({
      data: { noteId, filename, storageKey, mimeType, size, userId },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
