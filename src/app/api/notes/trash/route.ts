import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/api-utils";

/** Notas na lixeira do usuário, mais recentes primeiro. */
export async function GET() {
  try {
    const userId = await requireUserId();

    const notes = await prisma.note.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        plainText: true,
        type: true,
        deletedAt: true,
      },
    });

    return NextResponse.json(notes);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
