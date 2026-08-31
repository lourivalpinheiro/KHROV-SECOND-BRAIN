import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/** Histórico de snapshots do perfil (peso/altura/metas), mais recente primeiro — pra comparar evolução a longo prazo. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const entries = await prisma.healthProfileHistory.findMany({
      where: { userId },
      orderBy: { recordedAt: "desc" },
    });
    return NextResponse.json(entries);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
