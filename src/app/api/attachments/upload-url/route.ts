import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { supabaseStorage, ATTACHMENTS_BUCKET, isSupabaseStorageConfigured } from "@/lib/supabase-storage";

/** Gera uma signed URL de upload pro cliente subir o arquivo direto pro Supabase Storage (bucket privado). */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!isSupabaseStorageConfigured || !supabaseStorage) {
      return jsonError(
        "Armazenamento de anexos (Supabase Storage) ainda não foi configurado. Preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.",
        503
      );
    }

    const body = await req.json().catch(() => ({}));
    const { noteId, filename } = body as { noteId?: string; filename?: string };

    if (!noteId || !filename) return jsonError("noteId e filename são obrigatórios.");

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note || note.userId !== userId) return jsonError("Nota não encontrada.", 404);

    const storageKey = `${userId}/${noteId}/${randomUUID()}-${filename}`;

    const { data, error } = await supabaseStorage.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(storageKey);

    if (error || !data) return jsonError("Erro ao preparar upload.", 502);

    return NextResponse.json({ uploadUrl: data.signedUrl, token: data.token, storageKey });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
