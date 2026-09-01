import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

/** Lista os pedidos de oração — ativos primeiro (mais recentes primeiro dentro de cada grupo), respondidos depois. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const requests = await prisma.prayerRequest.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(requests);
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
    if (!title) return jsonError("Escreva o pedido.");
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

    const request_ = await prisma.prayerRequest.create({ data: { userId, title, notes } });
    return NextResponse.json(request_);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
