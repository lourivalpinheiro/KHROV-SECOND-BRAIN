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
 * Garante que o usuário tenha as 4 pastas-raiz do PARA. Idempotente —
 * chamado a cada listagem de pastas. Pra cada categoria que ainda não
 * existe:
 *
 * 1. Se já existe uma pasta raiz (sem categoria) com o nome exato — ex: o
 *    usuário já tinha uma pasta "Áreas" antes dessa feature — adota ela
 *    (só marca a categoria) em vez de criar uma duplicata.
 * 2. Se além disso já existe também uma pasta com a categoria (de uma
 *    versão anterior dessa função, que criava duplicata em vez de adotar),
 *    funde as duas: nota e subpasta da pasta solta migram pra pasta
 *    categorizada, e a solta é removida.
 * 3. Senão, cria a pasta do zero.
 */
export async function ensureParaFolders(userId: string): Promise<void> {
  const existing = await prisma.folder.findMany({
    where: { userId },
    select: { id: true, name: true, parentId: true, paraCategory: true },
  });

  for (const c of PARA_CATEGORIES) {
    const tagged = existing.find((f) => f.paraCategory === c.category);
    const looseMatch = existing.find(
      (f) =>
        !f.paraCategory &&
        f.parentId === null &&
        f.id !== tagged?.id &&
        f.name.trim().toLowerCase() === c.name.toLowerCase()
    );

    if (tagged && looseMatch) {
      // Duplicata de uma versão anterior desta função — funde na pasta certa.
      await prisma.$transaction([
        prisma.note.updateMany({ where: { folderId: looseMatch.id }, data: { folderId: tagged.id } }),
        prisma.folder.updateMany({ where: { parentId: looseMatch.id }, data: { parentId: tagged.id } }),
        prisma.folder.delete({ where: { id: looseMatch.id } }),
      ]);
    } else if (!tagged && looseMatch) {
      // Adota a pasta que o usuário já tinha, em vez de duplicar.
      await prisma.folder.update({ where: { id: looseMatch.id }, data: { paraCategory: c.category } });
    } else if (!tagged) {
      await prisma.folder.create({ data: { userId, name: c.name, paraCategory: c.category } });
    }
  }
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
