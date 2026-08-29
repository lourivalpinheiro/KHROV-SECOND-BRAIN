import { prisma } from "@/lib/prisma";
import type { ParaCategory } from "@prisma/client";

/**
 * As 4 categorias-raiz do método PARA (Tiago Forte), na ordem em que devem
 * aparecer pro usuário: Projetos, Áreas, Recursos, Arquivo.
 */
export const PARA_CATEGORIES: { category: ParaCategory; name: string }[] = [
  { category: "PROJECTS", name: "Projetos" },
  { category: "AREAS", name: "Áreas" },
  { category: "RESOURCES", name: "Recursos" },
  { category: "ARCHIVE", name: "Arquivo" },
];

/**
 * Garante que o usuário tenha as 4 pastas-raiz do PARA, criando as que
 * faltarem. Idempotente — chamado a cada listagem de pastas, não altera
 * nada além de preencher o que estiver faltando (não mexe em pastas que o
 * usuário já criou por conta própria).
 */
export async function ensureParaFolders(userId: string): Promise<void> {
  const existing = await prisma.folder.findMany({
    where: { userId, paraCategory: { not: null } },
    select: { paraCategory: true },
  });
  const existingCategories = new Set(existing.map((f) => f.paraCategory));
  const missing = PARA_CATEGORIES.filter((c) => !existingCategories.has(c.category));
  if (missing.length === 0) return;

  await prisma.folder.createMany({
    data: missing.map((c) => ({ userId, name: c.name, paraCategory: c.category })),
  });
}

/**
 * A pasta Arquivo (categoria ARCHIVE do PARA) não pode ter subpastas — nem
 * criadas dentro dela, nem outra pasta movida pra dentro dela. Lança um erro
 * com mensagem amigável se a pasta-alvo não puder receber filhas.
 */
export async function assertCanHaveChildren(parentId: string | null): Promise<void> {
  if (!parentId) return;
  const parent = await prisma.folder.findUnique({
    where: { id: parentId },
    select: { paraCategory: true },
  });
  if (parent?.paraCategory === "ARCHIVE") {
    throw new Error("A pasta Arquivo não pode ter subpastas.");
  }
}

/** Retorna o id da pasta + ids de todas as subpastas (recursivo, qualquer profundidade). */
export async function getFolderAndDescendantIds(folderId: string): Promise<string[]> {
  const ids = [folderId];
  let frontier = [folderId];

  while (frontier.length) {
    const children = await prisma.folder.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    if (children.length === 0) break;
    const childIds = children.map((c) => c.id);
    ids.push(...childIds);
    frontier = childIds;
  }

  return ids;
}
