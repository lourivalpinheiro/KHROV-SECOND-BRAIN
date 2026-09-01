import { Sparkles } from "lucide-react";

/**
 * Módulo Espiritual — ainda não existe de verdade, só reserva o lugar na
 * navegação (ordem pedida: Espiritual, Saúde, Conhecimento, Financeiro).
 * Constrói-se depois.
 */
export default function EspiritualPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      <Sparkles className="size-8 text-primary" />
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Espiritual</h1>
      <p className="max-w-sm">Em breve disponível — esse módulo ainda vai ser construído.</p>
    </div>
  );
}
