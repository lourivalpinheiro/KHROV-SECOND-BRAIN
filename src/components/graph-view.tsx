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
import { Network, Plus, Minus, Maximize, RotateCcw, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "note" = nota de verdade (clique navega pra /notes/[id]); "tag" = nó
// sintetizado no client a partir das tags de cada nota (não vem do banco
// como nó — clique navega pra /notes?tag=[tagId], estilo Obsidian).
type GraphNode = SimulationNodeDatum & {
  id: string;
  title: string;
  kind: "note" | "tag";
  tagId?: string;
  isHub?: boolean;
};
type GraphLink = SimulationLinkDatum<GraphNode>;
type GraphData = {
  nodes: { id: string; title: string; isHub: boolean; tags: { id: string; name: string }[] }[];
  links: { source: string; target: string }[];
};
type Point = { x: number; y: number };
// Prefixo pra ids de nó de tag nunca colidirem com um id de nota (cuid).
const TAG_NODE_PREFIX = "tag:";

const WIDTH = 1000;
const HEIGHT = 700;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
// Multiplicadores de repulsão/raio de colisão enquanto um nó está sendo
// arrastado — bem mais fortes que o normal, pra quem está por perto ter
// que "se afastar de verdade" em vez de só reajustar sutilmente.
const DRAG_CHARGE_STRENGTH = -700;
const DRAG_COLLIDE_RADIUS = 60;

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Posições iniciais espalhadas pelo canvas (não perto de um ponto só) —
 * usada tanto na primeira formação quanto no replay. Sem isso, os nós
 * nascem grudados perto da origem (é o que o d3-force faz por padrão
 * quando x/y não são setados) e, com a física mais devagar de propósito
 * (ver alphaDecay abaixo), ficam vários segundos parecendo uma bolota
 * confusa antes de se separarem — espalhar de saída evita essa fase de
 * "bagunça".
 *
 * Função de fora do componente de propósito: mutação + Math.random() aqui
 * dentro do corpo de GraphView fazem o lint das regras do React Compiler
 * (react-hooks/purity, react-hooks/immutability) reclamar, mesmo só sendo
 * chamado no cálculo do layout (useMemo) ou a partir de um clique — o
 * analisador não distingue esses contextos de "durante a renderização".
 */
function scatterAcross(nodes: GraphNode[], width: number, height: number) {
  for (const n of nodes) {
    n.x = width * (0.15 + Math.random() * 0.7);
    n.y = height * (0.15 + Math.random() * 0.7);
    n.vx = 0;
    n.vy = 0;
    n.fx = null;
    n.fy = null;
  }
}

export function GraphView() {
  // Sem revalidação automática (foco da aba, reconexão, polling): o grafo
  // mantém sua própria física/posições em memória (fx/fy, x/y mutados
  // direto nos nós) — se `data` trocar de referência no meio de um
  // arrasto ou da animação de formação, o layout inteiro é recriado do
  // zero (useMemo depende de `data`), "soltando" o nó sendo arrastado e
  // reiniciando a formação. Só busca de novo ao montar a página.
  const { data, isLoading } = useSWR<GraphData>("/api/graph", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
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

    // Nós de nota, como sempre veio da API.
    const nodes: GraphNode[] = data.nodes.map((n) => ({ id: n.id, title: n.title, kind: "note", isHub: n.isHub }));
    const links: GraphLink[] = data.links.map((l) => ({ source: l.source, target: l.target }));

    // Sintetiza um nó por tag (deduplicado por id) e uma ligação nota→tag
    // pra cada tag que a nota tem — a API só manda o cru (tags por nota),
    // é aqui que vira grafo de verdade, estilo Obsidian (tag também é nó).
    const seenTags = new Map<string, string>(); // tagId -> nome
    for (const n of data.nodes) {
      for (const t of n.tags) seenTags.set(t.id, t.name);
    }
    for (const [tagId, name] of seenTags) {
      nodes.push({ id: `${TAG_NODE_PREFIX}${tagId}`, title: `#${name}`, kind: "tag", tagId });
    }
    for (const n of data.nodes) {
      for (const t of n.tags) {
        links.push({ source: n.id, target: `${TAG_NODE_PREFIX}${t.id}` });
      }
    }

    const degree = new Map<string, number>();
    for (const l of links) {
      const s = l.source as string;
      const t = l.target as string;
      degree.set(s, (degree.get(s) ?? 0) + 1);
      degree.set(t, (degree.get(t) ?? 0) + 1);
    }

    // Grafo MUITO denso — precisa de um pouco mais de espaço pra não virar
    // uma bola de nós grudados — mas só entra em ação acima de ~80 nós
    // (sqrt(80/80)=1): grafos pequenos/médios ficam exatamente no
    // espaçamento original, sem essa esticada. Cresce a "tela" virtual
    // (viewBox) e a repulsão; a distância de link e o raio de colisão
    // ficam fixos — eram eles que estavam empurrando tudo longe demais.
    const scale = Math.min(1.4, Math.max(1, Math.sqrt(nodes.length / 80)));
    const width = WIDTH * scale;
    const height = HEIGHT * scale;

    // Nasce já espalhado pelo canvas — ver o comentário de scatterAcross.
    scatterAcross(nodes, width, height);

    const normalChargeStrength = -260 * scale;
    const normalCollideRadius = 34;
    const chargeForce = forceManyBody().strength(normalChargeStrength);
    const collideForce = forceCollide(normalCollideRadius);

    // .stop() impede o timer interno do d3 de rodar sozinho — quem avança a
    // simulação é o rAF loop em runSimulation(), chamado tanto no carregamento
    // (grafo "se formando") quanto durante o arrasto de um nó — é isso que faz
    // os outros nós reagirem de verdade (física, não só os filhos diretos
    // seguindo por um deslocamento fixo) em vez de ficarem parados.
    // Abaixo do padrão do d3 (~0.0228) — formação devagar, somada ao reveal
    // escalonado dos nós (ver revealOrder/effect abaixo). Como os nós já
    // nascem espalhados (scatterAcross acima), não precisa ser tão extremo
    // quanto seria pra "desembolar" um aglomerado — só suaviza o
    // reposicionamento fino (link/collide) enquanto os nós vão surgindo.
    const sim = forceSimulation(nodes)
      .alphaDecay(0.012)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(85)
          .strength(0.5)
      )
      .force("charge", chargeForce)
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", collideForce)
      .stop();

    // Ordem em que os nós vão "aparecendo" na animação inicial — hubs (mais
    // conectados) primeiro, depois seus vizinhos, dando a sensação de a
    // rede crescer a partir dos pontos centrais em vez de tudo já estar lá
    // só se reposicionando.
    const revealOrder = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)).map((n) => n.id);

    return {
      nodes,
      links,
      degree,
      sim,
      chargeForce,
      collideForce,
      normalChargeStrength,
      normalCollideRadius,
      width,
      height,
      revealOrder,
    };
  }, [data]);

  // Reveal escalonado: em vez do grafo inteiro (nós + conexões) já estar
  // presente na primeira renderização só se reacomodando pela física, os
  // nós vão surgindo um a um (ordem em revealOrder) — uma conexão só
  // aparece quando as DUAS pontas já foram reveladas. Duração total
  // proporcional ao tamanho do grafo, mas com teto (~5.5s) pra grafos
  // grandes não demorarem uma eternidade pra terminar de aparecer.
  const [revealCount, setRevealCount] = useState(0);
  // Incrementado pelo botão de replay — não muda `layout` (não tem por quê
  // refazer o layout inteiro), só força o efeito de reveal abaixo a rodar
  // de novo do zero.
  const [replayTick, setReplayTick] = useState(0);
  // Reseta a contagem assim que `layout` muda de identidade — feito durante
  // a própria renderização (padrão "adjusting state" do React), não dentro
  // do efeito abaixo, que só deve setState de forma assíncrona (dentro do
  // callback do setInterval).
  const prevLayoutRef = useRef(layout);
  if (prevLayoutRef.current !== layout) {
    prevLayoutRef.current = layout;
    setRevealCount(0);
  }
  useEffect(() => {
    const total = layout?.revealOrder.length ?? 0;
    if (total === 0) return;
    const stepMs = Math.max(60, Math.min(300, 5500 / total));
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealCount(i);
      if (i >= total) clearInterval(id);
    }, stepMs);
    // Centraliza tudo assim que os nós terminam de aparecer, e de novo um
    // pouco depois (a física ainda continua se ajustando por mais alguns
    // instantes após o reveal terminar) — sem isso, a câmera fica onde
    // estava por padrão, que não necessariamente enquadra o grafo inteiro.
    const settleTimer = setTimeout(fitAllToView, total * stepMs + 1500);
    return () => {
      clearInterval(id);
      clearTimeout(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fitAllToView é redefinida a cada render mas só precisa existir no momento em que o timeout dispara, não na identidade capturada aqui
  }, [layout, replayTick]);
  const revealedIds = useMemo(
    () => new Set(layout?.revealOrder.slice(0, revealCount) ?? []),
    [layout, revealCount]
  );

  /** Botão "replay": espalha os nós de novo perto do centro e reaquece a simulação — revive a animação de formação inteira, sem precisar recarregar a página. */
  function replayAnimation() {
    if (!layout) return;
    scatterAcross(layout.nodes, layout.width, layout.height);
    layout.sim.alpha(1).alphaTarget(0);
    setRevealCount(0);
    setReplayTick((t) => t + 1);
    runSimulation();
  }

  // Mantém o loop de tick num ref, não um efeito — precisa poder ser
  // "acordado" a qualquer momento (início do arrasto de um nó), não só
  // quando o grafo é carregado pela primeira vez.
  const rafRef = useRef(0);
  const runningRef = useRef(false);

  function runSimulation() {
    if (!layout || runningRef.current) return;
    runningRef.current = true;
    const { sim, nodes } = layout;

    function step() {
      sim.tick();
      setPositions(Object.fromEntries(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])));
      if (sim.alpha() > sim.alphaMin()) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        runningRef.current = false;
      }
    }
    rafRef.current = requestAnimationFrame(step);
  }

  // Anima o grafo "se formando" ao carregar (ou trocar de dado) — mesmo
  // comportamento de antes, só que agora runSimulation() é reaproveitado
  // pelo arrasto também.
  useEffect(() => {
    runSimulation();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runSimulation não muda de identidade de um jeito que importe aqui
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

  /**
   * Centraliza e enquadra TODOS os nós na tela de uma vez (independente de
   * onde o arrasto/pan deixou a câmera) — calcula a caixa que envolve as
   * posições atuais e ajusta zoom+pan pra caber tudo com uma margem.
   * Diferente de resetZoom: aquele só volta pan/zoom pro padrão (0,0,1),
   * que não necessariamente mostra o grafo inteiro — este de fato calcula
   * o enquadramento a partir de onde os nós estão agora.
   */
  function fitAllToView() {
    if (!layout || layout.nodes.length === 0) return;
    // Lê x/y direto dos nós (sempre atual, mutado pela simulação a cada
    // tick) em vez do state `positions` — evita pegar um valor
    // desatualizado quando chamado de dentro de um callback antigo (ex: o
    // setInterval do reveal, que captura o closure de quando foi criado).
    const pts = layout.nodes.map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 }));
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const boxW = Math.max(1, maxX - minX);
    const boxH = Math.max(1, maxY - minY);
    // 0.85 = deixa ~15% de margem ao redor, não cola os nós nas bordas.
    const k = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((layout.width / boxW) * 0.85, (layout.height / boxH) * 0.85))
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({ k, x: layout.width / 2 - cx * k, y: layout.height / 2 - cy * k });
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

    const node = layout?.nodes.find((n) => n.id === id);
    if (node && layout) {
      // Fixa o nó arrastado na posição atual (fx/fy) e "esquenta" a
      // simulação de novo (alphaTarget > 0) — com isso, os outros nós
      // reagem via física de verdade (link/charge/collide) a cada frame,
      // em vez de só os filhos diretos seguirem por um deslocamento fixo.
      node.fx = node.x;
      node.fy = node.y;
      // Repulsão temporariamente bem mais forte enquanto dura o arrasto —
      // é isso que faz quem está por perto "se destanciar" de verdade do
      // nó sendo movido, não só reajustar de leve.
      layout.chargeForce.strength(DRAG_CHARGE_STRENGTH);
      layout.collideForce.radius(DRAG_COLLIDE_RADIUS);
      // SÓ alphaTarget, sem .restart() — quem avança a simulação é o rAF
      // loop manual (runSimulation), não o timer interno do d3 (por isso
      // .stop() na criação). .restart() reativava ESSE timer interno em
      // paralelo ao nosso, dobrando o trabalho de física a cada frame
      // durante todo o arrasto (e por vários segundos depois, até alpha
      // decair) — é isso que travava a página ao mexer no grafo.
      layout.sim.alphaTarget(0.3);
      runSimulation();
    }
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
      const node = layout?.nodes.find((n) => n.id === dragNodeId.current);
      if (node) {
        // Só atualiza fx/fy (posição fixada) — quem propaga o movimento pros
        // outros nós é o tick da simulação (runSimulation), não este handler.
        node.fx = (node.fx ?? node.x ?? 0) + e.movementX / transform.k;
        node.fy = (node.fy ?? node.y ?? 0) + e.movementY / transform.k;
      }
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
    if (dragNodeId.current && layout) {
      // Solta o nó (deixa de estar fixado) e esfria a simulação de volta —
      // com alphaTarget(0) ela continua rodando mais uns instantes (dá pra
      // ver tudo se acomodando) e depois para sozinha.
      const node = layout.nodes.find((n) => n.id === dragNodeId.current);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      // Volta a repulsão/colisão pro valor normal (escalado pelo tamanho do
      // grafo) — o boost de DRAG_CHARGE_STRENGTH/DRAG_COLLIDE_RADIUS era só
      // enquanto durava o arrasto.
      layout.chargeForce.strength(layout.normalChargeStrength);
      layout.collideForce.radius(layout.normalCollideRadius);
      layout.sim.alphaTarget(0);
    }
    dragNodeId.current = null;
    panState.current = null;
    setIsDragging(false);
  }

  function onNodeClick(n: GraphNode) {
    // Evita navegar quando o clique foi na verdade um arrasto.
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    router.push(n.kind === "tag" ? `/notes?tag=${n.tagId}` : `/notes/${n.id}`);
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
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Centralizar tudo" onClick={fitAllToView}>
          <Focus />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" title="Repetir animação de formação" onClick={replayAnimation}>
          <RotateCcw />
        </Button>
      </div>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
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
            // Só desenha a conexão quando as DUAS pontas já apareceram — é
            // isso que faz a rede se revelar "aos poucos" em vez de todas as
            // linhas já estarem lá desde o primeiro frame.
            const revealed = revealedIds.has(s.id) && revealedIds.has(t.id);
            // Linhas bem sutis por padrão (estilo Obsidian) — só ganham
            // destaque quando o hover toca uma das duas pontas.
            const highlighted = hovered && connected.has(s.id) && connected.has(t.id);
            return (
              <line
                key={i}
                x1={sp.x}
                y1={sp.y}
                x2={tp.x}
                y2={tp.y}
                stroke="var(--muted-foreground)"
                strokeOpacity={revealed ? (dim ? 0.06 : highlighted ? 0.9 : 0.35) : 0}
                strokeWidth={highlighted ? 1.75 : 1}
                className="transition-[stroke-opacity] duration-500"
              />
            );
          })}
          {layout.nodes.map((n) => {
            const deg = layout.degree.get(n.id) ?? 0;
            // Nós pequenos e discretos, crescendo pouco com o grau — estilo
            // Obsidian, onde o destaque vem do hub ter mais linhas saindo,
            // não de um círculo enorme. Notas marcadas como Hub (ver
            // isHub) começam maiores e mais destacadas — são "índice de
            // assunto" de propósito, faz sentido saltar aos olhos.
            const r = (n.isHub ? 7 : 4) + Math.min(9, deg * 1.3);
            const dim = !isDragging && hovered && !connected.has(n.id);
            const pos = nodePos(n);
            const revealed = revealedIds.has(n.id);
            // Rótulo só aparece sob demanda — hover (o nó ou um vizinho
            // dele), zoom aproximado, hub bem conectado, ou marcado como
            // Hub — não todos os títulos o tempo todo, que é o que vira
            // "bagunça" ilegível com muitos nós. Tag sempre mostra (são
            // poucas, e o nome é o que dá contexto ao nó laranja).
            const showLabel =
              revealed &&
              (n.kind === "tag" || n.isHub || transform.k > 1.15 || hovered === n.id || connected.has(n.id) || deg >= 6);
            return (
              <g
                key={n.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className={cn(
                  "cursor-grab transition-opacity duration-500 active:cursor-grabbing",
                  !revealed && "pointer-events-none"
                )}
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onNodeClick(n)}
                opacity={!revealed ? 0 : dim ? 0.2 : 1}
              >
                <circle
                  r={r}
                  className={n.kind === "tag" ? "fill-amber-500" : n.isHub ? "fill-chart-2" : "fill-primary"}
                  stroke="var(--background)"
                  strokeWidth={n.isHub ? 2.5 : 1.5}
                />
                {showLabel && (
                  <text
                    x={r + 5}
                    y={4}
                    fontSize={12}
                    fontWeight={n.isHub ? 600 : 400}
                    className={cn(
                      "select-none",
                      n.kind === "tag" ? "fill-amber-500" : n.isHub ? "fill-chart-2" : "fill-foreground"
                    )}
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {n.title || "Sem título"}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
