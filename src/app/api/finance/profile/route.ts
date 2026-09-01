import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.financeProfile.findUnique({ where: { userId } });
    return NextResponse.json(profile);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    const startingCashBalance = Number(body.startingCashBalance);
    if (!Number.isFinite(startingCashBalance)) return jsonError("Saldo de caixa inválido.");

    const dateStr = typeof body.startingBalanceDate === "string" && DATE_RE.test(body.startingBalanceDate) ? body.startingBalanceDate : null;
    if (!dateStr) return jsonError("Data do saldo inicial inválida.");
    const startingBalanceDate = new Date(`${dateStr}T00:00:00.000Z`);

    const profile = await prisma.financeProfile.upsert({
      where: { userId },
      update: { startingCashBalance, startingBalanceDate },
      create: { userId, startingCashBalance, startingBalanceDate },
    });

    return NextResponse.json(profile);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
