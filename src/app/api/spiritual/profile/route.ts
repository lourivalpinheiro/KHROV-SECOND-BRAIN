import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.spiritualProfile.findUnique({ where: { userId } });
    return NextResponse.json(profile);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/** Salva os dias planejados de ida à igreja — upsert simples, sem histórico (não muda com a frequência das outras metas). */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    let churchPlanDays = [0, 2, 4];
    if (Array.isArray(body.churchPlanDays)) {
      const nums: number[] = body.churchPlanDays
        .map((d: unknown) => Number(d))
        .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);
      churchPlanDays = Array.from(new Set(nums)).sort((a, b) => a - b);
    } else {
      return jsonError("Dias inválidos.");
    }

    const profile = await prisma.spiritualProfile.upsert({
      where: { userId },
      update: { churchPlanDays },
      create: { userId, churchPlanDays },
    });

    return NextResponse.json(profile);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
