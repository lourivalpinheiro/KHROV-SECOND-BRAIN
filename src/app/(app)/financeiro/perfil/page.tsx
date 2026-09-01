"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { fetcher, patchJSON, postJSON, deleteJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dailyAllowance, toLocalDateKey } from "@/lib/finance";
import { toast } from "sonner";

type FinanceProfile = { startingCashBalance: number; startingBalanceDate: string } | null;
type BudgetVariable = { id: string; name: string; amount: number };

/**
 * Onde entra o saldo inicial de CAIXA (ponto de partida do saldo/projeção
 * — ver src/lib/finance.ts) e as "variáveis" livres que somadas ÷ 30
 * formam o teto de gasto do dia. Investimento não entra aqui — vive
 * sempre num cofrinho (ver /financeiro/cofrinhos), não como um número
 * solto no perfil.
 */
export default function PerfilFinanceiroPage() {
  const { data: profile, isLoading } = useSWR<FinanceProfile>("/api/finance/profile", fetcher);
  const { data: variables } = useSWR<BudgetVariable[]>("/api/finance/budget-variables", fetcher);

  const [startingCashBalance, setStartingCashBalance] = useState("0");
  const [startingBalanceDate, setStartingBalanceDate] = useState(() => toLocalDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  const [newVarName, setNewVarName] = useState("");
  const [newVarAmount, setNewVarAmount] = useState("");

  useEffect(() => {
    if (!profile || loaded.current) return;
    loaded.current = true;
    setStartingCashBalance(String(profile.startingCashBalance));
    setStartingBalanceDate(profile.startingBalanceDate);
  }, [profile]);

  async function saveProfile() {
    const cash = Number(startingCashBalance);
    if (!Number.isFinite(cash)) {
      toast.error("Saldo de caixa inválido.");
      return;
    }
    setSaving(true);
    try {
      await patchJSON("/api/finance/profile", { startingCashBalance: cash, startingBalanceDate });
      await mutate("/api/finance/profile");
      await mutate("/api/finance/summary");
      toast.success("Perfil salvo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function addVariable() {
    const amount = Number(newVarAmount);
    if (!newVarName.trim()) {
      toast.error("Dê um nome pra variável.");
      return;
    }
    if (!Number.isFinite(amount)) {
      toast.error("Valor inválido.");
      return;
    }
    try {
      await postJSON("/api/finance/budget-variables", { name: newVarName.trim(), amount });
      setNewVarName("");
      setNewVarAmount("");
      await mutate("/api/finance/budget-variables");
      await mutate("/api/finance/summary");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar.");
    }
  }

  async function removeVariable(id: string) {
    try {
      await deleteJSON(`/api/finance/budget-variables/${id}`);
      await mutate("/api/finance/budget-variables");
      await mutate("/api/finance/summary");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  }

  const cap = dailyAllowance(variables ?? []);

  if (isLoading) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Settings2 className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Perfil financeiro</h1>
        </div>

        <div className="mb-6 space-y-5 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold">Saldo inicial de caixa</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              &ldquo;Eu tenho R$X na conta hoje&rdquo; — ponto de partida do saldo atual e da projeção. Investimento não
              entra aqui: crie um cofrinho do tipo Investimento em{" "}
              <Link href="/financeiro/cofrinhos" className="text-primary hover:underline">
                Cofrinhos
              </Link>
              . Pode reajustar quando quiser (ex: conferir com o extrato real).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="starting-balance">Valor (R$)</Label>
              <Input
                id="starting-balance"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={startingCashBalance}
                onChange={(e) => setStartingCashBalance(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="starting-date">Data</Label>
              <Input
                id="starting-date"
                type="date"
                value={startingBalanceDate}
                onChange={(e) => setStartingBalanceDate(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            Salvar
          </Button>
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold">Previsão de gasto diário</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Adicione quantas variáveis quiser (nome + valor mensal) — a soma ÷ 30 é o teto de hoje. Zera à meia-noite,
              sem sobra acumulada do dia anterior.
            </p>
          </div>

          {variables && variables.length > 0 && (
            <div className="space-y-1.5">
              {variables.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span>{v.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      R$ {v.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVariable(v.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="var-name">Nome</Label>
              <Input id="var-name" value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="Ex: Salário" />
            </div>
            <div className="w-28 space-y-2">
              <Label htmlFor="var-amount">Valor (R$)</Label>
              <Input
                id="var-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={newVarAmount}
                onChange={(e) => setNewVarAmount(e.target.value)}
              />
            </div>
            <Button size="icon" onClick={addVariable} title="Adicionar">
              <Plus />
            </Button>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            Teto de hoje: <span className="font-semibold">R$ {cap.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
