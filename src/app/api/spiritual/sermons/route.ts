import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

const STATUSES = ["DRAFT", "READY", "PREACHED"];

// Esqueleto de pregação expositiva (texto → contexto → ideia central →
// estrutura → Cristo na passagem → aplicação) — ponto de partida editável,
// não uma trava. Ver contexto no AskUserQuestion desta sessão: o app foca
// em expositiva, não temática, por isso o sermão já nasce com esse fio.
const SERMON_SKELETON = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Contexto" }] },
    { type: "paragraph" },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Ideia central da passagem (proposição)" }] },
    { type: "paragraph" },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Estrutura do texto" }] },
    { type: "paragraph" },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Cristo na passagem" }] },
    { type: "paragraph" },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Aplicação" }] },
    { type: "paragraph" },
  ],
};

/** Lista os sermões do usuário — filtro opcional por status via `?status=` ou por série via `?seriesId=`. */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const seriesId = searchParams.get("seriesId");

    const sermons = await prisma.sermon.findMany({
      where: {
        userId,
        ...(status && STATUSES.includes(status) ? { status: status as never } : {}),
        ...(seriesId ? { seriesId } : {}),
      },
      select: {
        id: true,
        title: true,
        passage: true,
        status: true,
        date: true,
        order: true,
        updatedAt: true,
        seriesId: true,
        series: { select: { id: true, title: true } },
      },
      orderBy: seriesId ? { order: "asc" } : { updatedAt: "desc" },
    });

    return NextResponse.json(
      sermons.map((s) => ({ ...s, date: s.date ? s.date.toISOString().slice(0, 10) : null }))
    );
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/**
 * Cria um sermão — pregação expositiva parte do texto, então título E
 * passagem são obrigatórios (o corpo já nasce com um esqueleto expositivo
 * editável). Pode nascer já dentro de uma série (ex: 3 sermões na mesma
 * passagem/tema) — `order` calculado automaticamente como o próximo da
 * série.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const passage = typeof body.passage === "string" ? body.passage.trim() : "";
    if (!title) return jsonError("Dê um título pro sermão.");
    if (!passage) return jsonError("Pregação expositiva parte do texto — informe a passagem.");

    let seriesId: string | null = null;
    let order = 0;
    if (typeof body.seriesId === "string" && body.seriesId) {
      const series = await prisma.sermonSeries.findUnique({ where: { id: body.seriesId } });
      if (!series || series.userId !== userId) return jsonError("Série não encontrada.", 404);
      seriesId = series.id;
      const last = await prisma.sermon.findFirst({ where: { seriesId }, orderBy: { order: "desc" } });
      order = (last?.order ?? -1) + 1;
    }

    const sermon = await prisma.sermon.create({
      data: { userId, title, passage, seriesId, order, content: SERMON_SKELETON },
    });

    return NextResponse.json(sermon);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
