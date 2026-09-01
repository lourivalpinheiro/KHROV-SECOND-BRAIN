"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { CheckCircle2, ChevronDown, Target, TriangleAlert } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { goalProgressPercent } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Pocket = {
  id: string;
  name: string;
  kind: "SAVINGS" | "INVESTMENT";
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

function daysUntil(dateKey: string): number {
  const target = new Date(`${dateKey}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

/**
 * Metas — usa o mesmo cofrinho como base (valor guardado = saldo do
 * cofrinho), só adiciona valor-alvo, prazo e quanto guardar por mês. A
 * barra de progresso sobe conforme o saldo do cofrinho sobe (depósitos
 * menos resgates), nada especial de cálculo além disso.
 */
export default function MetasPage() {
  const { data: pockets, isLoading } = useSWR<Pocket[]>("/api/finance/pockets", fetcher);
  const searchParams = useSearchParams();
  const focusId = searchParams.get("pocket");
  const [editingId, setEditingId] = useState<string | null>(() => focusId);

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  const goals = (pockets ?? []).filter((p) => p.targetAmount && p.targetAmount > 0);
  const withoutGoal = (pockets ?? []).filter((p) => !p.targetAmount);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Target className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Metas</h1>
        </div>

        {!pockets || pockets.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Crie um cofrinho primeiro em Cofrinhos, depois volte aqui pra definir a meta dele.
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((p) => (
              <GoalCard key={p.id} pocket={p} editing={editingId === p.id} onToggleEdit={() => setEditingId((id) => (id === p.id ? null : p.id))} />
            ))}

            {withoutGoal.length > 0 && (
              <>
                <h2 className="pt-2 text-sm font-semibold text-muted-foreground">Cofrinhos sem meta</h2>
                {withoutGoal.map((p) => (
                  <GoalCard key={p.id} pocket={p} editing={editingId === p.id} onToggleEdit={() => setEditingId((id) => (id === p.id ? null : p.id))} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalCard({ pocket, editing, onToggleEdit }: { pocket: Pocket; editing: boolean; onToggleEdit: () => void }) {
  const [targetAmount, setTargetAmount] = useState(pocket.targetAmount ? String(pocket.targetAmount) : "");
  const [targetDate, setTargetDate] = useState(pocket.targetDate ?? "");
  const [monthlyContribution, setMonthlyContribution] = useState(
    pocket.monthlyContribution ? String(pocket.monthlyContribution) : ""
  );
  const [cdiPercentage, setCdiPercentage] = useState(pocket.cdiPercentage ? String(pocket.cdiPercentage) : "");
  const [maturityDate, setMaturityDate] = useState(pocket.maturityDate ?? "");
  const [saving, setSaving] = useState(false);

  const hasGoal = pocket.targetAmount && pocket.targetAmount > 0;
  const pct = hasGoal ? goalProgressPercent(pocket.balance, pocket.targetAmount!) : 0;
  const remainingDays = pocket.targetDate ? daysUntil(pocket.targetDate) : null;

  let onPace: boolean | null = null;
  if (hasGoal && pocket.targetDate && pocket.monthlyContribution !== null) {
    const monthsRemaining = Math.max((remainingDays ?? 0) / 30.44, 0.01);
    const missing = pocket.targetAmount! - pocket.balance;
    const neededPerMonth = missing > 0 ? missing / monthsRemaining : 0;
    onPace = pocket.monthlyContribution >= neededPerMonth - 0.01;
  }

  async function save() {
    setSaving(true);
    try {
      await patchJSON(`/api/finance/pockets/${pocket.id}`, {
        targetAmount: targetAmount === "" ? null : Number(targetAmount),
        targetDate: targetDate || null,
        monthlyContribution: monthlyContribution === "" ? null : Number(monthlyContribution),
        cdiPercentage: pocket.kind === "INVESTMENT" ? (cdiPercentage === "" ? null : Number(cdiPercentage)) : undefined,
        maturityDate: pocket.kind === "INVESTMENT" ? maturityDate || null : undefined,
      });
      await mutate("/api/finance/pockets");
      toast.success("Meta salva.");
      onToggleEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <button type="button" onClick={onToggleEdit} className="flex w-full items-center justify-between gap-2 text-left">
        <div>
          <div className="text-sm font-medium">{pocket.name}</div>
          <div className="text-lg font-semibold tracking-tight">{money(pocket.balance)}</div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", editing && "rotate-180")} />
      </button>

      {hasGoal && !editing && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
            <span>
              {pct.toFixed(0)}% de {money(pocket.targetAmount!)}
              {remainingDays !== null && (remainingDays >= 0 ? ` · ${remainingDays} dias restantes` : " · prazo vencido")}
            </span>
            {onPace !== null && (
              <span className={cn("inline-flex items-center gap-1", onPace ? "text-primary" : "text-destructive")}>
                {onPace ? <CheckCircle2 className="size-3" /> : <TriangleAlert className="size-3" />}
                {onPace ? "no ritmo" : "abaixo do ritmo"}
              </span>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor da meta (R$)</Label>
            <Input type="number" inputMode="decimal" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prazo</Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Guardar por mês (R$)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
            />
          </div>
          {pocket.kind === "INVESTMENT" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">% do CDI</Label>
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
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
              </div>
            </>
          )}
          <div className="sm:col-span-3">
            <Button size="sm" onClick={save} disabled={saving}>
              Salvar meta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
