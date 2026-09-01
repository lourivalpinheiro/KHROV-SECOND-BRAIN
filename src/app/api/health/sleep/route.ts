import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { parseTimeToMinutes, toLocalDateKey } from "@/lib/health";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Registros de sono num período — só os dias que de fato têm registro, sem preencher buraco (o gráfico lida com isso). */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const defaultFrom = (() => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return firstDayOfMonthKey(d);
    })();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const fromKey = fromParam && DATE_RE.test(fromParam) ? fromParam : defaultFrom;
    const toKey = toParam && DATE_RE.test(toParam) ? toParam : toLocalDateKey(now);

    const rows = await prisma.healthSleepDay.findMany({
      where: {
        userId,
        date: { gte: new Date(`${fromKey}T00:00:00.000Z`), lte: new Date(`${toKey}T23:59:59.999Z`) },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(rows.map((r) => ({ date: toLocalDateKey(r.date), bedtimeMinutes: r.bedtimeMinutes })));
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/** Registra (upsert) a hora que foi dormir numa data — aceita `bedtimeMinutes` direto ou `time` ("HH:MM"). */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    const dateStr = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
    if (!dateStr) return jsonError("Data inválida.");

    let bedtimeMinutes: number | null = null;
    if (Number.isInteger(body.bedtimeMinutes) && body.bedtimeMinutes >= 0 && body.bedtimeMinutes <= 1439) {
      bedtimeMinutes = body.bedtimeMinutes;
    } else if (typeof body.time === "string") {
      bedtimeMinutes = parseTimeToMinutes(body.time);
    }
    if (bedtimeMinutes === null) return jsonError("Horário inválido.");

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const day = await prisma.healthSleepDay.upsert({
      where: { userId_date: { userId, date } },
      update: { bedtimeMinutes },
      create: { userId, date, bedtimeMinutes },
    });

    return NextResponse.json({ date: dateStr, bedtimeMinutes: day.bedtimeMinutes });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
