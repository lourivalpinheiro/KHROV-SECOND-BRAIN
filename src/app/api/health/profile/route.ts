import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await prisma.healthProfile.findUnique({ where: { userId } });
    return NextResponse.json(profile);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    const weightKg = Number(body.weightKg);
    const heightCm = Number(body.heightCm);
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
      return jsonError("Peso inválido.");
    }
    if (!Number.isFinite(heightCm) || heightCm <= 0 || heightCm > 300) {
      return jsonError("Altura inválida.");
    }

    let gymPlanDays = [1, 3, 5];
    if (Array.isArray(body.gymPlanDays)) {
      const nums: number[] = body.gymPlanDays
        .map((d: unknown) => Number(d))
        .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);
      gymPlanDays = Array.from(new Set(nums)).sort((a, b) => a - b);
    }

    const waterGoalBottles = Number.isInteger(body.waterGoalBottles) && body.waterGoalBottles > 0
      ? body.waterGoalBottles
      : 4;

    const profile = await prisma.healthProfile.upsert({
      where: { userId },
      update: { weightKg, heightCm, gymPlanDays, waterGoalBottles },
      create: { userId, weightKg, heightCm, gymPlanDays, waterGoalBottles },
    });

    // Snapshot pro histórico de evolução — a cada save, não só na criação,
    // pra registrar peso/altura/metas mudando ao longo do tempo.
    await prisma.healthProfileHistory.create({
      data: { userId, weightKg, heightCm, gymPlanDays, waterGoalBottles },
    });

    return NextResponse.json(profile);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
