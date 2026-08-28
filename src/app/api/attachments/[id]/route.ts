import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { r2, R2_BUCKET, isR2Configured } from "@/lib/r2";

/** Retorna uma URL presignada de download (o bucket é privado). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.userId !== userId) return jsonError("Anexo não encontrado.", 404);

    if (!isR2Configured || !r2) return jsonError("Armazenamento não configurado.", 503);

    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: attachment.r2Key,
        ResponseContentDisposition: `attachment; filename="${attachment.filename}"`,
      }),
      { expiresIn: 300 }
    );

    return NextResponse.json({ url });
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

    if (isR2Configured && r2) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: attachment.r2Key })).catch(() => {});
    }

    await prisma.attachment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
