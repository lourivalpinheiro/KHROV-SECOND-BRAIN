/**
 * Renderizador de gráfico estático (SVG puro, sem React/recharts) — é o que
 * vai pro HTML exportado (PDF/impressão, generateHTML): o bloco de gráfico
 * de verdade usa recharts/shadcn no editor (ver chart-node-view.tsx), mas
 * isso é JS/React em cima de canvas/SVG animado, não sobrevive a
 * generateHTML (que só serializa renderHTML de cada node). Em vez de
 * simplesmente sumir no PDF, cai pra esta versão mais simples — mesmos
 * dados, sem interatividade/tooltip/animação.
 */

export type ChartType = "bar" | "line" | "area" | "pie" | "radar";
export type ChartSeriesDef = { key: string; label: string; color: string };
export type ChartDataRow = Record<string, string | number>;

/**
 * Cores fixas (não `var(--chart-N)`) — o SVG estático vira o HTML exportado
 * pra PDF/impressão, que roda num iframe isolado sem o CSS do app (só a
 * STYLE inline de export-pdf.ts). Uma var() sem definição vira inválida e a
 * forma cai pra preto sólido. Usar hex direto funciona igual em qualquer
 * contexto — é a mesma paleta usada como padrão ao criar um gráfico novo
 * (chart-node.ts), tanto pro bloco vivo (recharts) quanto pra esta versão.
 * Tons "500" (não "600") de propósito — mais vivos/claros, legíveis tanto
 * em fundo escuro (tema escuro do app) quanto em fundo branco (PDF).
 */
export const CHART_PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

const WIDTH = 600;
const HEIGHT = 320;
const PAD = { top: 20, right: 20, bottom: 36, left: 20 };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function numberOf(row: ChartDataRow, key: string): number {
  const v = row[key];
  return typeof v === "number" ? v : Number(v) || 0;
}

function legend(series: ChartSeriesDef[]): string {
  if (series.length < 2) return "";
  const itemW = WIDTH / series.length;
  const items = series
    .map(
      (s, i) =>
        `<g transform="translate(${i * itemW + 8},4)">` +
        `<rect width="10" height="10" rx="2" fill="${s.color}" />` +
        `<text x="16" y="9" font-size="11" fill="currentColor">${esc(s.label)}</text>` +
        `</g>`
    )
    .join("");
  return `<g class="chart-legend">${items}</g>`;
}

function cartesianAxes(categories: string[], plotX: number, plotY: number, plotW: number, plotH: number): string {
  const step = categories.length > 0 ? plotW / categories.length : plotW;
  const labels = categories
    .map((c, i) => {
      const x = plotX + step * i + step / 2;
      return `<text x="${x}" y="${plotY + plotH + 16}" font-size="10" text-anchor="middle" fill="currentColor" opacity="0.7">${esc(
        c.length > 12 ? `${c.slice(0, 11)}…` : c
      )}</text>`;
    })
    .join("");
  return (
    `<line x1="${plotX}" y1="${plotY + plotH}" x2="${plotX + plotW}" y2="${plotY + plotH}" stroke="currentColor" stroke-opacity="0.25" />` +
    labels
  );
}

function renderBar(data: ChartDataRow[], categoryKey: string, series: ChartSeriesDef[]): string {
  const legendH = series.length > 1 ? 24 : 0;
  const plotX = PAD.left;
  const plotY = PAD.top + legendH;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom - legendH;
  const max = Math.max(1, ...data.flatMap((row) => series.map((s) => numberOf(row, s.key))));
  const groupW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.max(2, (groupW * 0.7) / Math.max(1, series.length));
  const bars = data
    .map((row, i) => {
      const groupX = plotX + groupW * i + groupW * 0.15;
      return series
        .map((s, si) => {
          const v = numberOf(row, s.key);
          const h = (v / max) * plotH;
          const x = groupX + si * barW;
          const y = plotY + plotH - h;
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${s.color}" rx="2" />`;
        })
        .join("");
    })
    .join("");
  const categories = data.map((r) => String(r[categoryKey] ?? ""));
  return `${legend(series)}<g transform="translate(0,${legendH})">${bars}${cartesianAxes(categories, plotX, plotY - legendH, plotW, plotH)}</g>`;
}

function pointsFor(data: ChartDataRow[], key: string, max: number, plotX: number, plotY: number, plotW: number, plotH: number) {
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;
  return data.map((row, i) => {
    const v = numberOf(row, key);
    const x = data.length > 1 ? plotX + step * i : plotX + plotW / 2;
    const y = plotY + plotH - (v / max) * plotH;
    return { x, y };
  });
}

function renderLineOrArea(
  data: ChartDataRow[],
  categoryKey: string,
  series: ChartSeriesDef[],
  filled: boolean
): string {
  const legendH = series.length > 1 ? 24 : 0;
  const plotX = PAD.left;
  const plotY = PAD.top + legendH;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom - legendH;
  const max = Math.max(1, ...data.flatMap((row) => series.map((s) => numberOf(row, s.key))));
  const shapes = series
    .map((s) => {
      const pts = pointsFor(data, s.key, max, plotX, plotY, plotW, plotH);
      const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      if (!filled) {
        return `<polyline points="${line}" fill="none" stroke="${s.color}" stroke-width="2" />`;
      }
      const first = pts[0];
      const last = pts[pts.length - 1];
      const path = `M${first.x.toFixed(1)},${(plotY + plotH).toFixed(1)} L${line.replace(/ /g, " L")} L${last.x.toFixed(1)},${(plotY + plotH).toFixed(1)} Z`;
      return `<path d="${path}" fill="${s.color}" fill-opacity="0.25" stroke="${s.color}" stroke-width="2" />`;
    })
    .join("");
  const categories = data.map((r) => String(r[categoryKey] ?? ""));
  return `${legend(series)}<g transform="translate(0,${legendH})">${shapes}${cartesianAxes(categories, plotX, plotY - legendH, plotW, plotH)}</g>`;
}

function renderPie(data: ChartDataRow[], categoryKey: string, series: ChartSeriesDef[]): string {
  // Pizza só faz sentido pra UMA grandeza: usa a primeira série, uma fatia por linha de dado.
  const s = series[0];
  if (!s) return "";
  const total = data.reduce((sum, row) => sum + Math.max(0, numberOf(row, s.key)), 0) || 1;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2 + 4;
  const r = Math.min(WIDTH, HEIGHT) / 2 - 48;
  let angle = -Math.PI / 2;
  const slices = data
    .map((row, i) => {
      const v = Math.max(0, numberOf(row, s.key));
      const frac = v / total;
      const start = angle;
      angle += frac * Math.PI * 2;
      const end = angle;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const largeArc = end - start > Math.PI ? 1 : 0;
      const color = CHART_PALETTE[i % CHART_PALETTE.length];
      const label = String(row[categoryKey] ?? "");
      const path =
        v > 0
          ? `M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`
          : "";
      const legendY = 16 + i * 16;
      return (
        (path ? `<path d="${path}" fill="${color}" stroke="var(--background)" stroke-width="1.5" />` : "") +
        `<g transform="translate(${WIDTH - 150},${legendY})">` +
        `<rect width="10" height="10" rx="2" fill="${color}" /><text x="16" y="9" font-size="11" fill="currentColor">${esc(label)}</text>` +
        `</g>`
      );
    })
    .join("");
  return slices;
}

function renderRadar(data: ChartDataRow[], categoryKey: string, series: ChartSeriesDef[]): string {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2 + 6;
  const r = Math.min(WIDTH, HEIGHT) / 2 - 48;
  const n = data.length;
  const max = Math.max(1, ...data.flatMap((row) => series.map((s) => numberOf(row, s.key))));
  const angleFor = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;

  const rings = [0.25, 0.5, 0.75, 1]
    .map((frac) => {
      const pts = Array.from({ length: n }, (_, i) => {
        const a = angleFor(i);
        return `${(cx + r * frac * Math.cos(a)).toFixed(1)},${(cy + r * frac * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="currentColor" stroke-opacity="0.15" />`;
    })
    .join("");

  const axes = Array.from({ length: n }, (_, i) => {
    const a = angleFor(i);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    const label = String(data[i][categoryKey] ?? "");
    const lx = cx + (r + 14) * Math.cos(a);
    const ly = cy + (r + 14) * Math.sin(a);
    return (
      `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.15" />` +
      `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="10" text-anchor="middle" fill="currentColor" opacity="0.7">${esc(label)}</text>`
    );
  }).join("");

  const polygons = series
    .map((s) => {
      const pts = data
        .map((row, i) => {
          const v = numberOf(row, s.key);
          const a = angleFor(i);
          const rr = (v / max) * r;
          return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
        })
        .join(" ");
      return `<polygon points="${pts}" fill="${s.color}" fill-opacity="0.2" stroke="${s.color}" stroke-width="2" />`;
    })
    .join("");

  return `${rings}${axes}${polygons}${legend(series)}`;
}

export function renderStaticChartSvg(opts: {
  type: ChartType;
  data: ChartDataRow[];
  categoryKey: string;
  series: ChartSeriesDef[];
  title?: string;
}): string {
  const { type, data, categoryKey, series, title } = opts;
  if (data.length === 0 || series.length === 0) {
    return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" style="max-width:${WIDTH}px"><text x="${WIDTH / 2}" y="${HEIGHT / 2}" font-size="12" text-anchor="middle" fill="currentColor" opacity="0.6">Sem dados</text></svg>`;
  }
  let inner: string;
  switch (type) {
    case "bar":
      inner = renderBar(data, categoryKey, series);
      break;
    case "line":
      inner = renderLineOrArea(data, categoryKey, series, false);
      break;
    case "area":
      inner = renderLineOrArea(data, categoryKey, series, true);
      break;
    case "pie":
      inner = renderPie(data, categoryKey, series);
      break;
    case "radar":
      inner = renderRadar(data, categoryKey, series);
      break;
  }
  const titleEl = title
    ? `<text x="${WIDTH / 2}" y="16" font-size="13" font-weight="600" text-anchor="middle" fill="currentColor">${esc(title)}</text>`
    : "";
  // Sem cor fixa no style — texto/eixos usam fill/stroke="currentColor",
  // então herdam a cor do elemento pai onde o SVG for parar. No PDF
  // (export-pdf.ts) o body já fixa um texto escuro sobre fundo branco; no
  // snapshot da Linha do tempo (dentro do app, tema claro OU escuro) herda
  // do wrapper `.prose` — sem travar em uma cor só, funciona nos dois.
  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" style="max-width:${WIDTH}px">${titleEl}${inner}</svg>`;
}
