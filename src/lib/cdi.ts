/**
 * Busca a série diária do CDI (Banco Central, SGS série 12 — % ao dia) —
 * só usado no servidor (rota de API), nunca no cliente. Sem chave de API,
 * é um endpoint público. Dias sem publicação (fim de semana/feriado)
 * simplesmente não aparecem na resposta — quem consome trata como "não
 * rendeu nesse dia" (ver computeCdiEvolution em src/lib/finance.ts).
 */

function toBrDate(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export async function fetchCdiSeries(fromKey: string, toKey: string): Promise<Map<string, number>> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${toBrDate(fromKey)}&dataFinal=${toBrDate(toKey)}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error("Não foi possível buscar a série do CDI no Banco Central agora.");
  }
  const data: { data: string; valor: string }[] = await res.json();

  const map = new Map<string, number>();
  for (const row of data) {
    const [d, m, y] = row.data.split("/");
    map.set(`${y}-${m}-${d}`, Number(row.valor));
  }
  return map;
}
