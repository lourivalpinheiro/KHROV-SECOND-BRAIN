import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 60;

/** Últimas entradas do diário, mais recentes primeiro — cada uma é um dia com sua lista de itens. */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : DEFAULT_LIMIT;

    const rows = await prisma.gratitudeEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json(rows.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), items: r.items })));
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

const MAX_ITEMS = 20;
const MAX_ITEM_LENGTH = 280;

/** Salva a lista de itens de um dia inteiro (substitui a lista toda) — upsert por (userId, date). */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    const dateStr = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
    if (!dateStr) return jsonError("Data inválida.");
    if (!Array.isArray(body.items)) return jsonError("Itens inválidos.");

    const items: string[] = body.items
      .filter((i: unknown): i is string => typeof i === "string" && i.trim().length > 0)
      .map((i: string) => i.trim().slice(0, MAX_ITEM_LENGTH))
      .slice(0, MAX_ITEMS);

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const entry = await prisma.gratitudeEntry.upsert({
      where: { userId_date: { userId, date } },
      update: { items },
      create: { userId, date, items },
    });

    return NextResponse.json({ id: entry.id, date: dateStr, items: entry.items });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
