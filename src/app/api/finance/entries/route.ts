import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import {
  addMonthsClamped,
  dateFromKey,
  expandOccurrences,
  isEntryType,
  isRecurrenceKind,
  splitInstallments,
  toLocalDateKey,
} from "@/lib/finance";
import type { Prisma } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
function lastDayOfMonthKey(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/**
 * Lançamentos dentro de um período, já expandidos (uma linha por
 * OCORRÊNCIA, não por registro no banco — um lançamento mensal aparece
 * uma vez por mês dentro do range). Editar/excluir qualquer ocorrência
 * afeta o registro inteiro (não dá pra "pular" uma ocorrência isolada).
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const now = new Date();

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const fromKey = fromParam && DATE_RE.test(fromParam) ? fromParam : firstDayOfMonthKey(now);
    const toKey = toParam && DATE_RE.test(toParam) ? toParam : lastDayOfMonthKey(now);

    const typeParam = searchParams.get("type");
    const pocketId = searchParams.get("pocketId");
    const tagId = searchParams.get("tagId");

    const where: Prisma.FinanceEntryWhereInput = { userId };
    if (isEntryType(typeParam)) where.type = typeParam;
    if (pocketId) where.pocketId = pocketId;
    if (tagId) where.tags = { some: { tagId } };

    const rows = await prisma.financeEntry.findMany({
      where: {
        ...where,
        date: { lte: dateFromKey(toKey) },
        OR: [{ recurrenceEndDate: null }, { recurrenceEndDate: { gte: dateFromKey(fromKey) } }],
      },
      include: { tags: { include: { tag: true } }, pocket: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });

    const rangeStart = dateFromKey(fromKey);
    const rangeEnd = dateFromKey(toKey);

    const results = rows.flatMap((row) =>
      expandOccurrences(
        {
          date: toLocalDateKey(row.date),
          recurrence: row.recurrence,
          recurrenceEndDate: row.recurrenceEndDate ? toLocalDateKey(row.recurrenceEndDate) : null,
          excludedDates: row.excludedDates,
        },
        rangeStart,
        rangeEnd
      ).map((occurrenceDate) => ({
        id: row.id,
        occurrenceDate,
        type: row.type,
        description: row.description,
        amount: row.amount,
        recurrence: row.recurrence,
        recurrenceEndDate: row.recurrenceEndDate ? toLocalDateKey(row.recurrenceEndDate) : null,
        isRecurringOccurrence: row.recurrence !== "NONE",
        installmentNumber: row.installmentNumber,
        installmentTotal: row.installmentTotal,
        pocketId: row.pocketId,
        pocketName: row.pocket?.name ?? null,
        savingsDirection: row.savingsDirection,
        tags: row.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
      }))
    );

    results.sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate));
    return NextResponse.json(results);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

/**
 * Cria um lançamento. Se `installments` > 1, gera uma linha por parcela
 * (mesmo installmentGroupId), uma a cada mês a partir de `date` — cada
 * parcela é seu próprio lançamento, sem usar o motor de recorrência.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));

    if (!isEntryType(body.type)) return jsonError("Tipo de lançamento inválido.");
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!description) return jsonError("Descrição é obrigatória.");
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return jsonError("Valor inválido.");
    const dateStr = typeof body.date === "string" && DATE_RE.test(body.date) ? body.date : null;
    if (!dateStr) return jsonError("Data inválida.");

    const recurrence = isRecurrenceKind(body.recurrence) ? body.recurrence : "NONE";
    const recurrenceEndDate =
      typeof body.recurrenceEndDate === "string" && DATE_RE.test(body.recurrenceEndDate) ? body.recurrenceEndDate : null;

    const installmentsCount = Number.isInteger(body.installments) && body.installments > 1 ? body.installments : 1;

    const pocketId = body.type === "SAVINGS" && typeof body.pocketId === "string" && body.pocketId ? body.pocketId : null;
    if (pocketId) {
      const pocket = await prisma.financeSavingsPocket.findUnique({ where: { id: pocketId } });
      if (!pocket || pocket.userId !== userId) return jsonError("Cofrinho não encontrado.");
    }
    const savingsDirection = body.savingsDirection === "WITHDRAWAL" ? "WITHDRAWAL" : "DEPOSIT";

    const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds.filter((t: unknown) => typeof t === "string") : [];
    if (tagIds.length) {
      const count = await prisma.financeTag.count({ where: { userId, id: { in: tagIds } } });
      if (count !== tagIds.length) return jsonError("Alguma tag informada não existe.");
    }

    const amounts = installmentsCount > 1 ? splitInstallments(amount, installmentsCount) : [amount];
    const groupId = installmentsCount > 1 ? randomUUID() : null;

    const created = [];
    for (let i = 0; i < amounts.length; i++) {
      const occurrenceDate = i === 0 ? dateStr : addMonthsClamped(dateStr, i);
      const row = await prisma.financeEntry.create({
        data: {
          userId,
          type: body.type,
          description,
          amount: amounts[i],
          date: dateFromKey(occurrenceDate),
          recurrence: installmentsCount > 1 ? "NONE" : recurrence,
          recurrenceEndDate: installmentsCount > 1 ? null : recurrenceEndDate ? dateFromKey(recurrenceEndDate) : null,
          installmentGroupId: groupId,
          installmentNumber: installmentsCount > 1 ? i + 1 : null,
          installmentTotal: installmentsCount > 1 ? installmentsCount : null,
          pocketId,
          savingsDirection,
          tags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
        },
      });
      created.push(row);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
