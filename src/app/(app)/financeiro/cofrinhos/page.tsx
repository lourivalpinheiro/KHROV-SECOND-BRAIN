"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { LineChart, PiggyBank, Plus, Target } from "lucide-react";
import { fetcher, postJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { goalProgressPercent, toLocalDateKey } from "@/lib/finance";
import { toast } from "sonner";

type PocketKind = "SAVINGS" | "INVESTMENT";

type Pocket = {
  id: string;
  name: string;
  kind: PocketKind;
  balance: number;
  targetAmount: number | null;
  targetDate: string | null;
  monthlyContribution: number | null;
  cdiPercentage: number | null;
  maturityDate: string | null;
};

function money(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Cofrinhos — potes nomeados, de dois tipos: Poupança (metas, reservas) ou
 * Investimento (todo investimento precisa morar aqui — não existe saldo
 * de investimento solto no perfil). Lançamentos do tipo Economia podem
 * apontar pra qualquer um; a página dedicada (histórico + tabela) fica em
 * /financeiro/cofrinhos/[id]. Meta (valor/prazo) se define em /financeiro/metas.
 */
export default function CofrinhosPage() {
  const { data: pockets, isLoading } = useSWR<Pocket[]>("/api/finance/pockets", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PocketKind>("SAVINGS");
  const [startingBalance, setStartingBalance] = useState("");
  const [cdiPercentage, setCdiPercentage] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) {
      toast.error("Dê um nome pro cofrinho.");
      return;
    }
    setSaving(true);
    try {
      await postJSON("/api/finance/pockets", {
        name: name.trim(),
        kind,
        startingBalance: startingBalance || 0,
        startingBalanceDate: toLocalDateKey(new Date()),
        cdiPercentage: kind === "INVESTMENT" && cdiPercentage ? cdiPercentage : null,
        maturityDate: kind === "INVESTMENT" && maturityDate ? maturityDate : null,
      });
      setName("");
      setStartingBalance("");
      setCdiPercentage("");
      setMaturityDate("");
      setKind("SAVINGS");
      setShowForm(false);
      await mutate("/api/finance/pockets");
      await mutate("/api/finance/summary");
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
          <div className="mb-4 space-y-3 rounded-xl border bg-card p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Viagem, Tesouro Direto..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind((v as PocketKind) ?? "SAVINGS")}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue>{() => (kind === "SAVINGS" ? "Poupança" : "Investimento")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAVINGS">Poupança</SelectItem>
                    <SelectItem value="INVESTMENT">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Já tem guardado (R$)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {kind === "INVESTMENT" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">% do CDI (opcional)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={cdiPercentage}
                    onChange={(e) => setCdiPercentage(e.target.value)}
                    placeholder="Ex: 110"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vencimento (opcional)</Label>
                  <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Preenchendo os dois, a página do cofrinho calcula o rendimento real dia a dia com o CDI de verdade
                  (Banco Central) e mostra um gráfico de evolução.
                </p>
              </div>
            )}

            <Button onClick={create} disabled={saving}>
              Criar
            </Button>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !pockets || pockets.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum cofrinho ainda — crie um acima pra começar a guardar (ou investir) com um destino.
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
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {p.kind === "INVESTMENT" ? <LineChart className="size-3.5" /> : <PiggyBank className="size-3.5" />}
                    {p.kind === "INVESTMENT" ? "Investimento" : "Poupança"}
                    {p.cdiPercentage && <span>· {p.cdiPercentage}% CDI</span>}
                    {hasGoal && <Target className="size-3.5 text-primary" />}
                  </div>
                  <div className="text-sm font-medium">{p.name}</div>
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
