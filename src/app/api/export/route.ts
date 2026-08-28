import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/**
 * Backup completo do usuário em JSON — pastas, tags e notas (conteúdo
 * completo em Tiptap JSON), pra não depender só do Postgres em produção.
 * Anexos não são incluídos (o arquivo em si vive no R2), só os metadados.
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const [folders, tags, notes] = await Promise.all([
      prisma.folder.findMany({ where: { userId }, orderBy: { name: "asc" } }),
      prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } }),
      prisma.note.findMany({
        where: { userId },
        include: {
          tags: { include: { tag: true } },
          attachments: { select: { filename: true, mimeType: true, size: true, createdAt: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
      tags: tags.map((t) => ({ id: t.id, name: t.name })),
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
        content: n.content,
        plainText: n.plainText,
        folderId: n.folderId,
        dailyDate: n.dailyDate,
        tags: n.tags.map((t) => t.tag.name),
        attachments: n.attachments,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    };

    const filename = `thought-chain-backup-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
