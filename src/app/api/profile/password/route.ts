import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return jsonError("Preencha a senha atual e a nova senha.");
    }
    if (newPassword.length < 4) {
      return jsonError("A nova senha precisa ter pelo menos 4 caracteres.");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return jsonError("Usuário não encontrado.", 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return jsonError("Senha atual incorreta.", 401);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
