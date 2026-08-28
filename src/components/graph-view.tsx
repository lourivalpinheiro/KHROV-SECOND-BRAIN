"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { fetcher } from "@/lib/api-client";
import { Network } from "lucide-react";

type GraphNode = SimulationNodeDatum & { id: string; title: string; folderId: string | null };
type GraphLink = SimulationLinkDatum<GraphNode>;
type GraphData = { nodes: { id: string; title: string; folderId: string | null }[]; links: { source: string; target: string }[] };
type Point = { x: number; y: number };

const WIDTH = 1000;
const HEIGHT = 700;

export function GraphView() {
  const { data, isLoading } = useSWR<GraphData>("/api/graph", fetcher);
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const panState = useRef<Point | null>(null);
  const dragNodeId = useRef<string | null>(null);
  const dragMoved = useRef(false);

  const layout = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;

    const degree = new Map<string, number>();
    for (const l of data.links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }

    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = data.links.map((l) => ({ source: l.source, target: l.target }));

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(85)
          .strength(0.5)
      )
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collide", forceCollide(34))
      .stop();

    for (let i = 0; i < 300; i++) sim.tick();

    return { nodes, links, degree };
  }, [data]);

  // Posições iniciais (da simulação) — depois disso cada nó pode ser arrastado livremente.
  // Ajuste de estado durante a renderização (padrão oficial do React pra resetar
  // estado quando uma prop/derivação muda: https://react.dev/learn/you-might-not-need-an-effect),
  // usando estado (não ref) pra guardar o "anterior" já que refs não podem ser lidas no render.
  const [prevLayout, setPrevLayout] = useState<typeof layout>(null);
  if (layout && layout !== prevLayout) {
    setPrevLayout(layout);
    setPositions(Object.fromEntries(layout.nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])));
  }

  function nodePos(n: GraphNode): Point {
    return positions[n.id] ?? { x: n.x ?? 0, y: n.y ?? 0 };
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setTransform((t) => ({ ...t, k: Math.min(2.5, Math.max(0.3, t.k + delta)) }));
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    dragNodeId.current = id;
    dragMoved.current = false;
    setIsDragging(true);
    setHovered(id);
  }

  function onBackgroundPointerDown(e: React.PointerEvent) {
    panState.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragNodeId.current) {
      dragMoved.current = true;
      const id = dragNodeId.current;
      setPositions((prev) => {
        const current = prev[id] ?? { x: 0, y: 0 };
        return {
          ...prev,
          [id]: {
            x: current.x + e.movementX / transform.k,
            y: current.y + e.movementY / transform.k,
          },
        };
      });
      return;
    }
    const start = panState.current;
    if (!start) return;
    setTransform((t) => ({ ...t, x: e.clientX - start.x, y: e.clientY - start.y }));
  }

  function onPointerUp() {
    dragNodeId.current = null;
    panState.current = null;
    setIsDragging(false);
  }

  function onNodeClick(id: string) {
    // Evita navegar quando o clique foi na verdade um arrasto.
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    router.push(`/notes/${id}`);
  }

  if (isLoading) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Carregando grafo...</div>;
  }

  if (!layout) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Network className="size-8" />
        <p>Crie notas e conecte-as com [[ para ver o grafo.</p>
      </div>
    );
  }

  const connected = new Set<string>();
  if (hovered) {
    connected.add(hovered);
    for (const l of layout.links) {
      const s = typeof l.source === "object" ? (l.source as GraphNode).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as GraphNode).id : (l.target as string);
      if (s === hovered) connected.add(t);
      if (t === hovered) connected.add(s);
    }
  }

  return (
    <div className="flex-1 overflow-hidden">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {layout.links.map((l, i) => {
            const s = l.source as GraphNode;
            const t = l.target as GraphNode;
            const sp = nodePos(s);
            const tp = nodePos(t);
            const dim = !isDragging && hovered && !(connected.has(s.id) && connected.has(t.id));
            return (
              <line
                key={i}
                x1={sp.x}
                y1={sp.y}
                x2={tp.x}
                y2={tp.y}
                stroke="var(--muted-foreground)"
                strokeOpacity={dim ? 0.15 : 0.85}
                strokeWidth={dim ? 1.5 : 2}
              />
            );
          })}
          {layout.nodes.map((n) => {
            const r = 6 + Math.min(14, (layout.degree.get(n.id) ?? 0) * 2.5);
            const dim = !isDragging && hovered && !connected.has(n.id);
            const pos = nodePos(n);
            return (
              <g
                key={n.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onNodeClick(n.id)}
                opacity={dim ? 0.25 : 1}
              >
                <circle r={r} className="fill-primary" stroke="var(--background)" strokeWidth={2} />
                <text
                  x={r + 5}
                  y={4}
                  fontSize={12}
                  className="fill-foreground select-none"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {n.title || "Sem título"}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
