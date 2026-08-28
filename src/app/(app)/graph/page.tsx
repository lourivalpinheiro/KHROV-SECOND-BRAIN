import { GraphView } from "@/components/graph-view";

export default function GraphPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Grafo de notas</h1>
        <p className="text-sm text-muted-foreground">
          Arraste um nó para reposicioná-lo, arraste o fundo pra mover a câmera, use a roda do
          mouse pra zoom e clique numa nota pra abri-la.
        </p>
      </div>
      <GraphView />
    </div>
  );
}
