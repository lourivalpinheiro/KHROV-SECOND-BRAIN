import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TRASH_RETENTION_DAYS = 30;

/**
 * Rodado uma vez por dia pelo Vercel Cron (ver vercel.json) — apaga de vez
 * qualquer nota que está na lixeira há mais de 30 dias sem ser restaurada.
 * Autenticado via CRON_SECRET: a Vercel manda esse header sozinha em
 * invocações de cron quando a env var está configurada; qualquer outra
 * chamada (sem o header certo) é recusada, pra essa rota não virar um
 * "apagar em massa" público.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.note.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });

  return NextResponse.json({ purged: count });
}
