import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { isWeightGoalReached } from "@/lib/health";

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

/**
 * Salva o perfil. Só cria um snapshot em HealthProfileHistory quando
 * peso/altura de fato MUDAM — reenviar o mesmo peso de novo (ex: só
 * ajustando a meta ou os dias de academia) não gera uma entrada
 * redundante na Previsão nem no Histórico.
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const existing = await prisma.healthProfile.findUnique({ where: { userId } });

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

    // Meta de peso: só mexe no baseline/data-de-conquista quando a meta em
    // si muda (ou é definida pela primeira vez) — reenviar a MESMA meta de
    // novo não reinicia o progresso.
    const data: {
      weightKg: number;
      heightCm: number;
      gymPlanDays: number[];
      waterGoalBottles: number;
      targetWeightKg?: number | null;
      targetWeightBaselineKg?: number | null;
      targetWeightReachedAt?: Date | null;
      targetBedtimeMinutes?: number | null;
    } = { weightKg, heightCm, gymPlanDays, waterGoalBottles };

    if (body.targetWeightKg === null || body.targetWeightKg === "") {
      data.targetWeightKg = null;
      data.targetWeightBaselineKg = null;
      data.targetWeightReachedAt = null;
    } else if (body.targetWeightKg !== undefined) {
      const target = Number(body.targetWeightKg);
      if (!Number.isFinite(target) || target <= 0 || target > 500) return jsonError("Meta de peso inválida.");
      if (existing?.targetWeightKg !== target) {
        data.targetWeightKg = target;
        data.targetWeightBaselineKg = weightKg;
        data.targetWeightReachedAt = null;
      }
    }

    if (body.targetBedtimeMinutes === null || body.targetBedtimeMinutes === "") {
      data.targetBedtimeMinutes = null;
    } else if (body.targetBedtimeMinutes !== undefined) {
      const minutes = Number(body.targetBedtimeMinutes);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return jsonError("Hora-alvo de dormir inválida.");
      data.targetBedtimeMinutes = minutes;
    }

    const profile = await prisma.healthProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    // Se a meta acabou de ser batida agora (e ainda não tinha sido marcada), registra.
    let justReached = false;
    if (
      profile.targetWeightKg != null &&
      profile.targetWeightBaselineKg != null &&
      !profile.targetWeightReachedAt &&
      isWeightGoalReached(profile.weightKg, profile.targetWeightKg, profile.targetWeightBaselineKg)
    ) {
      await prisma.healthProfile.update({ where: { userId }, data: { targetWeightReachedAt: new Date() } });
      justReached = true;
    }

    // Snapshot pro histórico/previsão — só se peso ou altura de fato mudaram.
    if (!existing || existing.weightKg !== weightKg || existing.heightCm !== heightCm) {
      await prisma.healthProfileHistory.create({
        data: { userId, weightKg, heightCm, gymPlanDays, waterGoalBottles },
      });
    }

    return NextResponse.json({ ...profile, justReachedWeightGoal: justReached });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
