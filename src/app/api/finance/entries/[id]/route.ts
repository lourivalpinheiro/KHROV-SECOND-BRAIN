import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { addDays, dateFromKey, isEntryType, isRecurrenceKind, toLocalDateKey } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Edita UM lançamento (uma linha do banco). Pra recorrente, isso muda a
 * série inteira (passado e futuro) — não dá pra "destacar" uma ocorrência
 * isolada. Pra parcela, só aquela parcela específica muda.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const entry = await prisma.financeEntry.findUnique({ where: { id } });
    if (!entry || entry.userId !== userId) return jsonError("Lançamento não encontrado.", 404);

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (isEntryType(body.type)) data.type = body.type;
    if (typeof body.description === "string" && body.description.trim()) data.description = body.description.trim();
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return jsonError("Valor inválido.");
      data.amount = amount;
    }
    if (typeof body.date === "string") {
      if (!DATE_RE.test(body.date)) return jsonError("Data inválida.");
      data.date = dateFromKey(body.date);
    }
    if (isRecurrenceKind(body.recurrence)) data.recurrence = body.recurrence;
    if (body.recurrenceEndDate === null) {
      data.recurrenceEndDate = null;
    } else if (typeof body.recurrenceEndDate === "string" && DATE_RE.test(body.recurrenceEndDate)) {
      data.recurrenceEndDate = dateFromKey(body.recurrenceEndDate);
    }

    const effectiveType = (data.type as string | undefined) ?? entry.type;
    if (effectiveType === "SAVINGS") {
      if (body.pocketId === null) data.pocketId = null;
      else if (typeof body.pocketId === "string" && body.pocketId) {
        const pocket = await prisma.financeSavingsPocket.findUnique({ where: { id: body.pocketId } });
        if (!pocket || pocket.userId !== userId) return jsonError("Cofrinho não encontrado.");
        data.pocketId = body.pocketId;
      }
      if (body.savingsDirection === "DEPOSIT" || body.savingsDirection === "WITHDRAWAL") {
        data.savingsDirection = body.savingsDirection;
      }
    }

    if (Array.isArray(body.tagIds)) {
      const tagIds: string[] = body.tagIds.filter((t: unknown) => typeof t === "string");
      if (tagIds.length) {
        const count = await prisma.financeTag.count({ where: { userId, id: { in: tagIds } } });
        if (count !== tagIds.length) return jsonError("Alguma tag informada não existe.");
      }
      await prisma.financeEntryTag.deleteMany({ where: { entryId: id } });
      if (tagIds.length) {
        await prisma.financeEntryTag.createMany({ data: tagIds.map((tagId) => ({ entryId: id, tagId })) });
      }
    }

    const updated = await prisma.financeEntry.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/**
 * Exclui um lançamento. Pra um recorrente, `?mode=` decide o alcance:
 * "all" (padrão) apaga a série inteira; "future" corta a recorrência ali
 * (recurrenceEndDate = véspera de `occurrenceDate`, ou apaga tudo se for
 * a primeira ocorrência); "single" só pula aquele dia (excludedDates),
 * mantendo o resto da série intacto. `occurrenceDate` é obrigatório pra
 * "future"/"single".
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const entry = await prisma.financeEntry.findUnique({ where: { id } });
    if (!entry || entry.userId !== userId) return jsonError("Lançamento não encontrado.", 404);

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") ?? "all";
    const occurrenceDate = searchParams.get("occurrenceDate");

    if (entry.recurrence === "NONE" || mode === "all") {
      await prisma.financeEntry.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (!occurrenceDate || !DATE_RE.test(occurrenceDate)) {
      return jsonError("Data da ocorrência é obrigatória pra excluir só uma parte da recorrência.");
    }

    if (mode === "single") {
      const excludedDates = Array.from(new Set([...entry.excludedDates, occurrenceDate]));
      await prisma.financeEntry.update({ where: { id }, data: { excludedDates } });
      return NextResponse.json({ ok: true });
    }

    if (mode === "future") {
      const entryStartKey = toLocalDateKey(entry.date);
      if (occurrenceDate <= entryStartKey) {
        // Cortar a partir da primeira ocorrência (ou antes) equivale a apagar a série inteira.
        await prisma.financeEntry.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
      const cutoffKey = addDays(occurrenceDate, -1);
      await prisma.financeEntry.update({ where: { id }, data: { recurrenceEndDate: dateFromKey(cutoffKey) } });
      return NextResponse.json({ ok: true });
    }

    return jsonError("Modo de exclusão inválido.");
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
