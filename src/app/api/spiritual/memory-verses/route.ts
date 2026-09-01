import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const userId = await requireUserId();
    const verses = await prisma.memoryVerse.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    });
    return NextResponse.json(verses);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (!reference) return jsonError("Escreva a referência do versículo (ex: João 3:16).");
    const text = typeof body.text === "string" && body.text.trim() ? body.text.trim() : null;

    const verse = await prisma.memoryVerse.create({ data: { userId, reference, text } });
    return NextResponse.json(verse);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
