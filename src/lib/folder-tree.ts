/** Utilitários de árvore de pastas usados no client (achatar em lista, achar descendentes). */

export type FolderNode = { id: string; name: string; parentId: string | null };

function groupByParent<T extends FolderNode>(folders: T[]): Map<string | null, T[]> {
  const byParent = new Map<string | null, T[]>();
  for (const f of folders) {
    const key = f.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  return byParent;
}

/** Achata a árvore numa lista, com o caminho completo no label (ex: "Trabalho / Projetos"). */
export function flattenFolders<T extends FolderNode>(folders: T[]): { id: string; label: string }[] {
  const byParent = groupByParent(folders);
  const out: { id: string; label: string }[] = [];
  function walk(parentId: string | null, prefix: string) {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ id: f.id, label: `${prefix}${f.name}` });
      walk(f.id, `${prefix}${f.name} / `);
    }
  }
  walk(null, "");
  return out;
}

/** Id da pasta + todos os descendentes (qualquer profundidade) — pra evitar mover uma pasta pra dentro dela mesma. */
export function folderAndDescendantIds(folders: FolderNode[], rootId: string): Set<string> {
  const byParent = groupByParent(folders);
  const ids = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const next: string[] = [];
    for (const parentId of frontier) {
      for (const child of byParent.get(parentId) ?? []) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          next.push(child.id);
        }
      }
    }
    frontier = next;
  }
  return ids;
}
