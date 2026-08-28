import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { r2, R2_BUCKET, isR2Configured } from "@/lib/r2";

/** Gera uma URL presignada de PUT para o cliente subir o arquivo direto pro R2. */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();

    if (!isR2Configured || !r2) {
      return jsonError(
        "Armazenamento de anexos (Cloudflare R2) ainda não foi configurado. Preencha as variáveis R2_* no .env.",
        503
      );
    }

    const body = await req.json().catch(() => ({}));
    const { noteId, filename, mimeType } = body as {
      noteId?: string;
      filename?: string;
      mimeType?: string;
    };

    if (!noteId || !filename) return jsonError("noteId e filename são obrigatórios.");

    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note || note.userId !== userId) return jsonError("Nota não encontrada.", 404);

    const r2Key = `${userId}/${noteId}/${randomUUID()}-${filename}`;

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        ContentType: mimeType || "application/octet-stream",
      }),
      { expiresIn: 300 }
    );

    return NextResponse.json({ uploadUrl, r2Key });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
