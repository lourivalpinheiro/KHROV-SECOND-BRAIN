import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

/** Lista as séries do usuário com a contagem de sermões — ex: "Provérbios em 6 partes" pregada em datas diferentes sobre o mesmo texto/tema. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const series = await prisma.sermonSeries.findMany({
      where: { userId },
      include: { _count: { select: { sermons: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(series.map((s) => ({ ...s, sermonCount: s._count.sermons, _count: undefined })));
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return jsonError("Dê um título pra série.");
    const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;

    const series = await prisma.sermonSeries.create({ data: { userId, title, description } });
    return NextResponse.json(series);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
