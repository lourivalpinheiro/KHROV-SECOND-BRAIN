import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { EMPTY_DOC } from "@/lib/doc-utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatTitle(dateStr: string) {
  // dateStr é "YYYY-MM-DD" (data local do usuário, mandada pelo client) —
  // monta a data em UTC só pra formatar, sem envolver fuso horário do servidor.
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Busca (ou cria) a nota diária do dia informado — uma por usuário por dia. */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const dateStr = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
    if (!dateStr) return jsonError("Data inválida.", 400);

    const dailyDate = new Date(`${dateStr}T00:00:00.000Z`);

    const existing = await prisma.note.findUnique({
      where: { userId_dailyDate: { userId, dailyDate } },
    });
    if (existing) return NextResponse.json(existing);

    const note = await prisma.note.create({
      data: {
        title: formatTitle(dateStr),
        content: EMPTY_DOC as unknown as Prisma.InputJsonValue,
        plainText: "",
        type: "FLEETING",
        dailyDate,
        userId,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
