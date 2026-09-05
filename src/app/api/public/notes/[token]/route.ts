import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Rota pública, SEM autenticação de propósito — quem chama aqui é o
 * visitante de /p/[token], não o dono da conta. Só serve o que a própria
 * nota expõe (título, conteúdo, nome do autor, data) e só quando
 * isPublished=true; nunca antes disso, mesmo com o token certo em mãos
 * (despublicar precisa realmente cortar o acesso).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const note = await prisma.note.findUnique({
    where: { shareToken: token },
    select: {
      title: true,
      content: true,
      updatedAt: true,
      isPublished: true,
      user: { select: { name: true } },
    },
  });

  if (!note || !note.isPublished) {
    return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    title: note.title,
    content: note.content,
    updatedAt: note.updatedAt,
    authorName: note.user.name || "Autor",
  });
}
