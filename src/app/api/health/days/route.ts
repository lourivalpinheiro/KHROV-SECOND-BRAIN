import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { weekDateKeys } from "@/lib/health";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Os 7 dias (Dom..Sáb) da semana pedida — dias sem registro ainda vêm com os valores padrão (nada marcado), sem criar linha no banco à toa. */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const anchor = searchParams.get("date");
    const anchorDate = anchor && DATE_RE.test(anchor) ? new Date(`${anchor}T00:00:00`) : new Date();

    const keys = weekDateKeys(anchorDate);
    const rows = await prisma.healthDay.findMany({
      where: {
        userId,
        date: { gte: new Date(`${keys[0]}T00:00:00.000Z`), lte: new Date(`${keys[6]}T23:59:59.999Z`) },
      },
    });
    const byKey = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));

    const days = keys.map((key) => {
      const row = byKey.get(key);
      return {
        date: key,
        waterBottles: row?.waterBottles ?? 0,
        gym: row?.gym ?? false,
        notes: row?.notes ?? "",
      };
    });

    return NextResponse.json(days);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/** Marca garrafas de água (0..N), academia, ou salva as notas de um dia — upsert, sempre por (userId, date). */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    const dateStr = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
    if (!dateStr) return jsonError("Data inválida.");

    const data: { waterBottles?: number; gym?: boolean; notes?: string } = {};
    if (Number.isInteger(body.waterBottles) && body.waterBottles >= 0 && body.waterBottles <= 20) {
      data.waterBottles = body.waterBottles;
    }
    if (typeof body.gym === "boolean") data.gym = body.gym;
    if (typeof body.notes === "string") data.notes = body.notes;

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const day = await prisma.healthDay.upsert({
      where: { userId_date: { userId, date } },
      update: data,
      create: {
        userId,
        date,
        waterBottles: data.waterBottles ?? 0,
        gym: data.gym ?? false,
        notes: data.notes ?? "",
      },
    });

    return NextResponse.json({
      date: dateStr,
      waterBottles: day.waterBottles,
      gym: day.gym,
      notes: day.notes,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
