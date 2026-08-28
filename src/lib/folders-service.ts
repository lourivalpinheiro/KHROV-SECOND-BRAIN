import { prisma } from "@/lib/prisma";

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
