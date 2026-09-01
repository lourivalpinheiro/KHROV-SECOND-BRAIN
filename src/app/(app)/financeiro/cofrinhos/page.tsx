"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { PiggyBank, Plus, Target } from "lucide-react";
import { fetcher, postJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { goalProgressPercent } from "@/lib/finance";
import { toast } from "sonner";

type Pocket = {
  id: string;
  name: string;
  balance: number;
  targetAmount: number | null;
  targetDate: string | null;
  monthlyContribution: number | null;
};

function money(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

/**
 * Cofrinhos — potes de economia nomeados. Lançamentos do tipo Economia
 * podem apontar pra um; a página dedicada de cada um (histórico + tabela)
 * fica em /financeiro/cofrinhos/[id]. Definir meta (valor/prazo) pra um
 * cofrinho é lá em /financeiro/metas.
 */
export default function CofrinhosPage() {
  const { data: pockets, isLoading } = useSWR<Pocket[]>("/api/finance/pockets", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) {
      toast.error("Dê um nome pro cofrinho.");
      return;
    }
    setSaving(true);
    try {
      await postJSON("/api/finance/pockets", { name: name.trim() });
      setName("");
      setShowForm(false);
      await mutate("/api/finance/pockets");
      toast.success("Cofrinho criado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PiggyBank className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cofrinhos</h1>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus /> Novo
          </Button>
        </div>

        {showForm && (
          <div className="mb-4 flex items-end gap-2 rounded-xl border bg-card p-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagem, Reserva de emergência..." />
            </div>
            <Button onClick={create} disabled={saving}>
              Criar
            </Button>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !pockets || pockets.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum cofrinho ainda — crie um acima pra começar a guardar dinheiro com um destino.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pockets.map((p) => {
              const hasGoal = p.targetAmount && p.targetAmount > 0;
              const pct = hasGoal ? goalProgressPercent(p.balance, p.targetAmount!) : null;
              return (
                <Link
                  key={p.id}
                  href={`/financeiro/cofrinhos/${p.id}`}
                  className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                    {hasGoal && <Target className="size-3.5 text-primary" />}
                    {p.name}
                  </div>
                  <div className="text-xl font-semibold tracking-tight">{money(p.balance)}</div>
                  {hasGoal && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pct!.toFixed(0)}% de {money(p.targetAmount!)}
                      </p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
