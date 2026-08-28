import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

const MAX_IMAGE_LENGTH = 2_000_000; // ~1.5MB de imagem base64

export async function GET() {
  try {
    const userId = await requireUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true },
    });
    if (!user) return jsonError("Usuário não encontrado.", 404);
    return NextResponse.json(user);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return jsonError("Nome não pode ficar vazio.");
      data.name = name;
    }

    if (typeof body.email === "string") {
      const email = body.email.trim();
      if (!email) return jsonError("Usuário/email não pode ficar vazio.");
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return jsonError("Esse usuário/email já está em uso.");
      }
      data.email = email;
    }

    if (body.image === null) {
      data.image = null;
    } else if (typeof body.image === "string") {
      if (body.image.length > MAX_IMAGE_LENGTH) {
        return jsonError("Imagem muito grande. Escolha uma foto menor.");
      }
      data.image = body.image;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json(user);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
