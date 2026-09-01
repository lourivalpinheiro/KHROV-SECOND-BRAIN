import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ChartNodeView } from "./chart-node-view";
import { CHART_PALETTE, renderStaticChartSvg, type ChartDataRow, type ChartSeriesDef, type ChartType } from "@/lib/chart-svg";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    chart: {
      insertChart: () => ReturnType;
    };
  }
}

const DEFAULT_CATEGORY_KEY = "category";

function defaultData(): ChartDataRow[] {
  return [
    { [DEFAULT_CATEGORY_KEY]: "Jan", value: 12 },
    { [DEFAULT_CATEGORY_KEY]: "Fev", value: 19 },
    { [DEFAULT_CATEGORY_KEY]: "Mar", value: 8 },
  ];
}

function defaultSeries(): ChartSeriesDef[] {
  return [{ key: "value", label: "Valor", color: CHART_PALETTE[0] }];
}

/**
 * Bloco de gráfico — bar/line/area/pie/radar, dados editáveis na própria
 * nota (ver chart-node-view.tsx, que usa recharts/shadcn no editor vivo).
 * `renderHTML` (usado por generateHTML — export de PDF, e o `<article>`
 * de qualquer outro consumidor de HTML estático) NÃO consegue reaproveitar
 * o recharts (é JS/React, não sobrevive a serialização) — cai pro SVG
 * simples e estático de chart-svg.ts com os mesmos dados.
 */
export const Chart = Node.create({
  name: "chart",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      chartType: { default: "bar" as ChartType },
      title: { default: "" },
      categoryKey: { default: DEFAULT_CATEGORY_KEY },
      series: { default: defaultSeries() },
      data: { default: defaultData() },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const svgString = renderStaticChartSvg({
      type: node.attrs.chartType as ChartType,
      data: node.attrs.data as ChartDataRow[],
      categoryKey: node.attrs.categoryKey as string,
      series: node.attrs.series as ChartSeriesDef[],
      title: (node.attrs.title as string) || undefined,
    });
    // DOMOutputSpec aceita um Node de verdade como filho (não uma string
    // crua — atributos tipo "innerHTML" no array viram literalmente
    // setAttribute("innerhtml", ...), não injeção de HTML). Só roda no
    // client (generateHTML/getHTML, usados pra export de PDF e pro
    // snapshot da Linha do tempo), onde DOMParser sempre existe.
    const svgEl = new DOMParser().parseFromString(svgString, "image/svg+xml").documentElement;
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "chart", class: "chart-export" }), svgEl];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },

  addCommands() {
    return {
      insertChart:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { chartType: "bar", title: "", categoryKey: DEFAULT_CATEGORY_KEY, series: defaultSeries(), data: defaultData() },
            })
            .run(),
    };
  },
});
