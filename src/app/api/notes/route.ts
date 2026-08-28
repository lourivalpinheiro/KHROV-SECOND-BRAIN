import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";
import { EMPTY_DOC } from "@/lib/doc-utils";
import { isNoteType } from "@/lib/note-types";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId");
    const tagId = searchParams.get("tagId");
    const tagIds = searchParams.get("tagIds")?.split(",").filter(Boolean) ?? [];
    const q = searchParams.get("q");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

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
        ...(folderId ? { folderId } : {}),
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
        folder: true,
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
    const folderId = typeof body.folderId === "string" ? body.folderId : null;
    const type = isNoteType(body.type) ? body.type : "FLEETING";

    const note = await prisma.note.create({
      data: {
        title,
        content: EMPTY_DOC as unknown as Prisma.InputJsonValue,
        plainText: "",
        type,
        folderId,
        userId,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
