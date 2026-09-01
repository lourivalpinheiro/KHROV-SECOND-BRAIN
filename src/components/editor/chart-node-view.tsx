"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  CartesianGrid,
  XAxis,
} from "recharts";
import { BarChart3, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CHART_PALETTE, type ChartDataRow, type ChartSeriesDef, type ChartType } from "@/lib/chart-svg";

const TYPE_LABELS: Record<ChartType, string> = {
  bar: "Barras",
  line: "Linha",
  area: "Área",
  pie: "Pizza",
  radar: "Radar",
};

function renderChart(type: ChartType, data: ChartDataRow[], categoryKey: string, series: ChartSeriesDef[]) {
  if (type === "pie") {
    const s = series[0];
    return (
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey={categoryKey} />} />
        <Pie data={data} dataKey={s?.key ?? "value"} nameKey={categoryKey} outerRadius={90} label isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        {/* Legenda por categoria (não por série — pizza só tem uma série) —
            Legend cru do recharts, não o ChartLegendContent do shadcn:
            aquele resolve cor/rótulo via `config`, que aqui é indexado por
            série, não por categoria. */}
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    );
  }

  if (type === "radar") {
    return (
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey={categoryKey} tick={{ fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fontSize: 10 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Radar
            key={s.key}
            dataKey={s.key}
            stroke={`var(--color-${s.key})`}
            fill={`var(--color-${s.key})`}
            fillOpacity={0.3}
            isAnimationActive={false}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </RadarChart>
    );
  }

  if (type === "line") {
    return (
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={categoryKey} tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </LineChart>
    );
  }

  if (type === "area") {
    return (
      <AreaChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={categoryKey} tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            fill={`var(--color-${s.key})`}
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    );
  }

  // bar (padrão)
  return (
    <BarChart data={data}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey={categoryKey} tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
      <ChartTooltip content={<ChartTooltipContent />} />
      {series.map((s) => (
        <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={4} isAnimationActive={false} />
      ))}
      <ChartLegend content={<ChartLegendContent />} />
    </BarChart>
  );
}

/**
 * Bloco de gráfico editável — bar/line/area/pie/radar, dados numa
 * tabelinha simples (categoria + uma coluna por série). Usa o
 * ChartContainer/recharts padrão do shadcn (mesmo componente já usado em
 * Saúde/Financeiro) pro modo de leitura; o modo de edição é uma tabela
 * crua, sem trava nenhuma (é um bloco de conteúdo, não faz parte do
 * pipeline de promoção). O fallback estático pro PDF vive em
 * chart-node.ts/chart-svg.ts, não aqui — isto aqui só existe no editor
 * vivo.
 */
export function ChartNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const chartType = node.attrs.chartType as ChartType;
  const title = (node.attrs.title as string) ?? "";
  const categoryKey = (node.attrs.categoryKey as string) ?? "category";
  const series = (node.attrs.series as ChartSeriesDef[]) ?? [];
  const data = (node.attrs.data as ChartDataRow[]) ?? [];
  const [editing, setEditing] = useState(false);
  // `selected` (seleção de nó do ProseMirror) é frágil demais aqui — passar
  // o mouse sobre o gráfico (tooltip do recharts reagindo a hover) ou
  // qualquer outra interação some com ela quase na hora, antes de dar
  // tempo de clicar em editar/excluir. Controle manual próprio: clicar no
  // cabeçalho liga/desliga os botões, e fica assim até clicar de novo —
  // nada de precisar segurar ou ser rápido.
  const [active, setActive] = useState(false);
  const showActions = active || editing;

  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  );

  function setRow(i: number, key: string, value: string | number) {
    updateAttributes({ data: data.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)) });
  }
  function addRow() {
    const row: ChartDataRow = { [categoryKey]: `Item ${data.length + 1}` };
    for (const s of series) row[s.key] = 0;
    updateAttributes({ data: [...data, row] });
  }
  function removeRow(i: number) {
    updateAttributes({ data: data.filter((_, idx) => idx !== i) });
  }
  function addSeries() {
    const key = `s${series.length + 1}_${Date.now().toString(36)}`;
    const nextSeries = [...series, { key, label: `Série ${series.length + 1}`, color: CHART_PALETTE[series.length % CHART_PALETTE.length] }];
    updateAttributes({ series: nextSeries, data: data.map((row) => ({ ...row, [key]: 0 })) });
  }
  function removeSeries(key: string) {
    if (series.length <= 1) return;
    updateAttributes({ series: series.filter((s) => s.key !== key) });
  }
  function renameSeries(key: string, label: string) {
    updateAttributes({ series: series.map((s) => (s.key === key ? { ...s, label } : s)) });
  }

  return (
    <NodeViewWrapper className={`chart-block${active ? " chart-block-selected" : ""}`} contentEditable={false}>
      <div
        className="mb-2 flex cursor-pointer items-center justify-between gap-2 select-none"
        onClick={() => setActive((v) => !v)}
        title={active ? "Fechar controles" : "Editar/excluir este gráfico"}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <BarChart3 className="size-3.5 shrink-0" />
          <span className="truncate">{title || "Gráfico"}</span>
        </span>
        {showActions && (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditing((v) => !v)}
              title={editing ? "Ver gráfico" : "Editar dados"}
            >
              {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => deleteNode()}
              title="Excluir gráfico"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Select value={chartType} onValueChange={(v) => updateAttributes({ chartType: v })}>
              <SelectTrigger size="sm" className="h-7 w-28 shrink-0">
                <SelectValue>{() => TYPE_LABELS[chartType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as ChartType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Título (opcional)"
              className="h-7 flex-1 text-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left font-normal text-muted-foreground">Categoria</th>
                  {series.map((s) => (
                    <th key={s.key} className="p-1 text-left font-normal">
                      <div className="flex items-center gap-1">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        <input
                          value={s.label}
                          onChange={(e) => renameSeries(s.key, e.target.value)}
                          className="w-16 min-w-0 border-none bg-transparent p-0 text-xs outline-none"
                        />
                        {series.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSeries(s.key)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Remover série"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="p-1">
                    <button
                      type="button"
                      onClick={addSeries}
                      className="text-muted-foreground hover:text-foreground"
                      title="Adicionar série"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">
                      <input
                        value={String(row[categoryKey] ?? "")}
                        onChange={(e) => setRow(i, categoryKey, e.target.value)}
                        className="w-20 min-w-0 border-none bg-transparent p-0 text-xs outline-none"
                      />
                    </td>
                    {series.map((s) => (
                      <td key={s.key} className="p-1">
                        <input
                          type="number"
                          value={Number(row[s.key] ?? 0)}
                          onChange={(e) => setRow(i, s.key, Number(e.target.value))}
                          className="w-14 min-w-0 border-none bg-transparent p-0 text-xs outline-none"
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remover linha"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={addRow}>
            <Plus className="size-3" /> Adicionar linha
          </Button>
        </div>
      ) : (
        // aspect-video (padrão do ChartContainer) numa nota estreita de
        // celular vira um container baixo demais (~160px) — as barras
        // escalam certo entre si, mas ficam pequenas/espremidas demais
        // pra ler. Altura fixa em vez de depender só da largura resolve
        // em qualquer tela.
        <ChartContainer config={config} className="mx-auto aspect-auto h-64 w-full sm:h-72">
          {renderChart(chartType, data, categoryKey, series)}
        </ChartContainer>
      )}
    </NodeViewWrapper>
  );
}
