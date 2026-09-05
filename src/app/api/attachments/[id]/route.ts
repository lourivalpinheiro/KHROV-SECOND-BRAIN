import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { supabaseStorage, ATTACHMENTS_BUCKET, isSupabaseStorageConfigured } from "@/lib/supabase-storage";

/**
 * Retorna uma signed URL de visualização (o bucket é privado) — sem
 * `download`, de propósito: o pedido é abrir o anexo numa aba nova
 * (PDF/imagem renderizados pelo navegador), não forçar "salvar arquivo".
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.userId !== userId) return jsonError("Anexo não encontrado.", 404);

    if (!isSupabaseStorageConfigured || !supabaseStorage) return jsonError("Armazenamento não configurado.", 503);

    const { data, error } = await supabaseStorage.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.storageKey, 300);

    if (error || !data) return jsonError("Erro ao gerar link de visualização.", 502);

    return NextResponse.json({ url: data.signedUrl });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.userId !== userId) return jsonError("Anexo não encontrado.", 404);

    if (isSupabaseStorageConfigured && supabaseStorage) {
      await supabaseStorage.storage.from(ATTACHMENTS_BUCKET).remove([attachment.storageKey]).catch(() => {});
    }

    await prisma.attachment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
