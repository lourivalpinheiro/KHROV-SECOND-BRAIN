import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/**
 * Todas as folhas do caderno de treino (dias com observações não vazias),
 * mais recentes primeiro — usado pra montar a lista agrupada por mês em
 * /saude/caderno. Diferente de /api/health/days, que só olha uma semana
 * por vez.
 */
export async function GET() {
  try {
    const userId = await requireUserId();
    const rows = await prisma.healthDay.findMany({
      where: { userId, notes: { not: "" } },
      orderBy: { date: "desc" },
      select: { date: true, notes: true },
    });
    return NextResponse.json(rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), notes: r.notes })));
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
