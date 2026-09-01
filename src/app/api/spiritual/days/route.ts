import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { weekDateKeys } from "@/lib/spiritual";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Os 7 dias (Dom..Sáb) da semana pedida — dias sem registro vêm com tudo desmarcado, sem criar linha no banco à toa. */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const anchor = searchParams.get("date");
    const anchorDate = anchor && DATE_RE.test(anchor) ? new Date(`${anchor}T00:00:00`) : new Date();

    const keys = weekDateKeys(anchorDate);
    const rows = await prisma.spiritualDay.findMany({
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
        prayerMorning: row?.prayerMorning ?? false,
        prayerNight: row?.prayerNight ?? false,
        devotional: row?.devotional ?? false,
        churchAttended: row?.churchAttended ?? false,
      };
    });

    return NextResponse.json(days);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/** Marca oração/devocional/igreja de um dia — upsert, sempre por (userId, date). */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    const dateStr = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
    if (!dateStr) return jsonError("Data inválida.");

    const data: { prayerMorning?: boolean; prayerNight?: boolean; devotional?: boolean; churchAttended?: boolean } = {};
    if (typeof body.prayerMorning === "boolean") data.prayerMorning = body.prayerMorning;
    if (typeof body.prayerNight === "boolean") data.prayerNight = body.prayerNight;
    if (typeof body.devotional === "boolean") data.devotional = body.devotional;
    if (typeof body.churchAttended === "boolean") data.churchAttended = body.churchAttended;

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const day = await prisma.spiritualDay.upsert({
      where: { userId_date: { userId, date } },
      update: data,
      create: {
        userId,
        date,
        prayerMorning: data.prayerMorning ?? false,
        prayerNight: data.prayerNight ?? false,
        devotional: data.devotional ?? false,
        churchAttended: data.churchAttended ?? false,
      },
    });

    return NextResponse.json({
      date: dateStr,
      prayerMorning: day.prayerMorning,
      prayerNight: day.prayerNight,
      devotional: day.devotional,
      churchAttended: day.churchAttended,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
