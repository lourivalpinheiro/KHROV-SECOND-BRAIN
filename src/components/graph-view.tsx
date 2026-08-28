"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Network, Plus, Minus, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

type GraphNode = SimulationNodeDatum & { id: string; title: string; folderId: string | null };
type GraphLink = SimulationLinkDatum<GraphNode>;
type GraphData = { nodes: { id: string; title: string; folderId: string | null }[]; links: { source: string; target: string }[] };
type Point = { x: number; y: number };

const WIDTH = 1000;
const HEIGHT = 700;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

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
  const activePointers = useRef<Map<number, Point>>(new Map());
  const pinchStart = useRef<{ dist: number; k: number } | null>(null);

  const layout = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;

    const degree = new Map<string, number>();
    for (const l of data.links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }

    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = data.links.map((l) => ({ source: l.source, target: l.target }));

    // .stop() impede o timer interno do d3 de rodar sozinho — a gente avança
    // a simulação manualmente no useEffect abaixo, sincronizado com rAF, pra
    // dar tempo de renderizar cada passo (animação do grafo "se formando").
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

    return { nodes, links, degree, sim };
  }, [data]);

  // Roda a simulação em tempo real (em vez de resolver as 300 iterações de
  // uma vez só) toda vez que o grafo é (re)carregado, pra ver os nós saindo
  // do centro e se acomodando. Depois que a simulação esfria (ou o usuário
  // arrasta um nó), positions passa a ser a única fonte de verdade.
  useEffect(() => {
    if (!layout) return;
    const { sim, nodes } = layout;
    let raf = 0;
    let cancelled = false;

    function step() {
      if (cancelled) return;
      sim.tick();
      setPositions(Object.fromEntries(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])));
      if (sim.alpha() > sim.alphaMin()) {
        raf = requestAnimationFrame(step);
      }
    }
    raf = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [layout]);

  function nodePos(n: GraphNode): Point {
    return positions[n.id] ?? { x: n.x ?? 0, y: n.y ?? 0 };
  }

  function zoomBy(factor: number) {
    setTransform((t) => ({ ...t, k: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor)) }));
  }

  function resetZoom() {
    setTransform({ x: 0, y: 0, k: 1 });
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setTransform((t) => ({ ...t, k: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k + delta)) }));
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    dragNodeId.current = id;
    dragMoved.current = false;
    setIsDragging(true);
    setHovered(id);
  }

  function onBackgroundPointerDown(e: React.PointerEvent) {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2) {
      // Um segundo dedo entrou em jogo: troca de pan pra pinch-zoom.
      panState.current = null;
      const [a, b] = [...activePointers.current.values()];
      pinchStart.current = { dist: distance(a, b), k: transform.k };
    } else {
      panState.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...activePointers.current.values()];
      const ratio = distance(a, b) / pinchStart.current.dist;
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStart.current.k * ratio));
      setTransform((t) => ({ ...t, k }));
      return;
    }

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

  function onPointerUp(e: React.PointerEvent) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      pinchStart.current = null;
    }
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
    <div className="relative flex-1 overflow-hidden">
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Aumentar zoom" onClick={() => zoomBy(1.2)}>
          <Plus />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Diminuir zoom" onClick={() => zoomBy(1 / 1.2)}>
          <Minus />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Restaurar zoom" onClick={resetZoom}>
          <Maximize />
        </Button>
      </div>
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
