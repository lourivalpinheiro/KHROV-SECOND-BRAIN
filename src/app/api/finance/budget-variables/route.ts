import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

/** Lista as "variáveis" livres que compõem a previsão de gasto diário (ver src/lib/finance.ts). */
export async function GET() {
  try {
    const userId = await requireUserId();
    const variables = await prisma.financeBudgetVariable.findMany({
      where: { userId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(variables);
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
    const amount = Number(body.amount);
    if (!name) return jsonError("Nome é obrigatório.");
    if (!Number.isFinite(amount)) return jsonError("Valor inválido.");

    const count = await prisma.financeBudgetVariable.count({ where: { userId } });
    const variable = await prisma.financeBudgetVariable.create({
      data: { userId, name, amount, order: count },
    });
    return NextResponse.json(variable, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
