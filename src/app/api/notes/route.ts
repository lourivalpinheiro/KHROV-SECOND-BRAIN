import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { EMPTY_DOC, extractLinkedNoteIds, extractPlainText, type TiptapDoc } from "@/lib/doc-utils";
import { isNoteType, type NoteTypeValue } from "@/lib/note-types";
import { syncNoteLinks } from "@/lib/notes-service";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const tagId = searchParams.get("tagId");
    const tagIds = searchParams.get("tagIds")?.split(",").filter(Boolean) ?? [];
    const q = searchParams.get("q");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const types = (searchParams.get("types")?.split(",").filter(isNoteType) ?? []) as NoteTypeValue[];

    const allTagIds = tagId ? [tagId, ...tagIds] : tagIds;

    let updatedAt: Prisma.DateTimeFilter | undefined;
    if (from || to) {
      updatedAt = {};
      if (from) updatedAt.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) updatedAt.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const notes = await prisma.note.findMany({
      where: {
        userId,
        ...(types.length ? { type: { in: types } } : {}),
        // exige que a nota tenha TODAS as tags selecionadas
        ...(allTagIds.length ? { AND: allTagIds.map((id) => ({ tags: { some: { tagId: id } } })) } : {}),
        ...(updatedAt ? { updatedAt } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { plainText: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json(notes);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Nota sem título";
    const type = isNoteType(body.type) ? body.type : "STIMULUS";
    // Usado pelo fluxo de extração (Sessão → Estímulo): permite criar a
    // nota já com o trecho extraído, em vez de sempre nascer vazia.
    const content = (body.content as TiptapDoc | undefined) ?? EMPTY_DOC;
    const plainText = body.content !== undefined ? extractPlainText(content) : "";

    const note = await prisma.note.create({
      data: {
        title,
        content: content as unknown as Prisma.InputJsonValue,
        plainText,
        type,
        userId,
      },
    });

    // Se a nota já nasce com wikilinks no conteúdo (ex: extração do Córtex,
    // que referencia de volta a sessão de origem), sincroniza na hora — sem
    // isso, o link só apareceria nos backlinks depois da primeira edição.
    if (body.content !== undefined && extractLinkedNoteIds(content).length > 0) {
      await syncNoteLinks(note.id, content);
    }

    return NextResponse.json(note, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
