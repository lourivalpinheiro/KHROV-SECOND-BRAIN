import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { assertCanHaveChildren, ensureParaFolders } from "@/lib/folders-service";

export async function GET() {
  try {
    const userId = await requireUserId();
    await ensureParaFolders(userId);
    const folders = await prisma.folder.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: { _count: { select: { notes: true } } },
    });
    return NextResponse.json(folders);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const parentId = typeof body.parentId === "string" ? body.parentId : null;

    if (!name) return jsonError("Nome da pasta é obrigatório.");

    try {
      await assertCanHaveChildren(parentId);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Não é possível criar essa subpasta.");
    }

    // paraCategory nunca vem do client — só é preenchido pelas 4 pastas-raiz
    // do PARA, geradas automaticamente (ensureParaFolders).
    const folder = await prisma.folder.create({ data: { name, parentId, userId } });
    return NextResponse.json(folder, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
