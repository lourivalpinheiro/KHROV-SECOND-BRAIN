import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireUserId();
    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      // Não conta notas na lixeira — senão o número mostrado em /tags ficava
      // inflado com coisa que nem aparece mais em lugar nenhum.
      include: { _count: { select: { notes: { where: { note: { deletedAt: null } } } } } },
    });
    return NextResponse.json(tags);
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
    if (!name) return jsonError("Nome da tag é obrigatório.");

    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
