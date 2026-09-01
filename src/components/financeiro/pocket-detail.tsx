"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from "recharts";
import { ArrowLeft, LineChart, PiggyBank, Pencil, Settings2, Trash2, X } from "lucide-react";
import { fetcher, deleteJSON, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useConfirm } from "@/hooks/use-confirm";
import { useRouter } from "next/navigation";
import { goalProgressPercent, toLocalDateKey } from "@/lib/finance";
import { toast } from "sonner";

type Pocket = {
  id: string;
  name: string;
  kind: "SAVINGS" | "INVESTMENT";
  balance: number;
  startingBalance: number;
  startingBalanceDate: string | null;
  targetAmount: number | null;
  targetDate: string | null;
  monthlyContribution: number | null;
  cdiPercentage: number | null;
  maturityDate: string | null;
};

type CdiResponse = {
  enabled: boolean;
  cdiPercentage?: number;
  maturityDate?: string;
  points: { date: string; principal: number; adjusted: number }[];
};

const cdiChartConfig = {
  principal: { label: "Aportado", color: "var(--muted-foreground)" },
  adjusted: { label: "Com rendimento", color: "var(--primary)" },
} satisfies ChartConfig;

function money(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PocketDetail({ pocketId }: { pocketId: string }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const rangeLoaded = useRef(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [balanceDateInput, setBalanceDateInput] = useState("");
  const [savingBalance, setSavingBalance] = useState(false);

  const { data: pocket, isLoading: loadingPocket } = useSWR<Pocket>(`/api/finance/pockets/${pocketId}`, fetcher);

  const cdiEligible = !!pocket?.cdiPercentage;
  const { data: cdiData, isLoading: loadingCdi } = useSWR<CdiResponse>(
    cdiEligible ? `/api/finance/pockets/${pocketId}/cdi` : null,
    fetcher
  );

  // Assim que o cofrinho carrega, o filtro de data começa mostrando o
  // histórico inteiro (desde o saldo inicial até hoje) — o cálculo em si
  // sempre parte da data do saldo inicial, o filtro só recorta o que
  // aparece no gráfico.
  useEffect(() => {
    if (!pocket || rangeLoaded.current) return;
    rangeLoaded.current = true;
    setFromDate(pocket.startingBalanceDate ?? toLocalDateKey(new Date()));
    setToDate(toLocalDateKey(new Date()));
  }, [pocket]);

  const cdiChartData = useMemo(() => {
    const points = cdiData?.points ?? [];
    return points
      .filter((p) => (!fromDate || p.date >= fromDate) && (!toDate || p.date <= toDate))
      .map((p) => ({ date: p.date, principal: p.principal, adjusted: p.adjusted }));
  }, [cdiData, fromDate, toDate]);

  const cdiYield = useMemo(() => {
    if (!cdiData || cdiData.points.length === 0) return null;
    const last = cdiData.points[cdiData.points.length - 1];
    const yieldValue = last.adjusted - last.principal;
    const yieldPct = last.principal > 0 ? (yieldValue / last.principal) * 100 : 0;
    return { value: yieldValue, pct: yieldPct };
  }, [cdiData]);

  function startEditBalance() {
    setBalanceInput(pocket ? String(pocket.startingBalance) : "0");
    setBalanceDateInput(pocket?.startingBalanceDate ?? toLocalDateKey(new Date()));
    setEditingBalance(true);
  }

  async function saveBalance() {
    const n = Number(balanceInput);
    if (!Number.isFinite(n)) {
      toast.error("Valor inválido.");
      return;
    }
    setSavingBalance(true);
    try {
      await patchJSON(`/api/finance/pockets/${pocketId}`, {
        startingBalance: n,
        startingBalanceDate: balanceDateInput || toLocalDateKey(new Date()),
      });
      await mutate(`/api/finance/pockets/${pocketId}`);
      await mutate("/api/finance/pockets");
      await mutate("/api/finance/summary");
      setEditingBalance(false);
      toast.success("Saldo ajustado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ajustar saldo.");
    } finally {
      setSavingBalance(false);
    }
  }

  async function deletePocket() {
    const ok = await confirm({
      title: `Excluir o cofrinho "${pocket?.name}"?`,
      description: "Os lançamentos continuam existindo, só deixam de apontar pra esse cofrinho.",
      confirmLabel: "Excluir cofrinho",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(`/api/finance/pockets/${pocketId}`);
      await mutate("/api/finance/pockets");
      toast.success("Cofrinho excluído.");
      router.push("/financeiro/cofrinhos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  if (loadingPocket) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  if (!pocket) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Cofrinho não encontrado.</div>;
  }

  const hasGoal = pocket.targetAmount && pocket.targetAmount > 0;
  const pct = hasGoal ? goalProgressPercent(pocket.balance, pocket.targetAmount!) : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/financeiro/cofrinhos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Cofrinhos
        </Link>

        <div className="mb-6 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {pocket.kind === "INVESTMENT" ? (
              <LineChart className="size-5 text-muted-foreground" />
            ) : (
              <PiggyBank className="size-5 text-muted-foreground" />
            )}
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{pocket.name}</h1>
              <p className="text-xs text-muted-foreground">{pocket.kind === "INVESTMENT" ? "Investimento" : "Poupança"}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" render={<Link href={`/financeiro/metas?pocket=${pocketId}`} />} title="Definir meta">
              <Settings2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={deletePocket} className="text-destructive hover:text-destructive" title="Excluir">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Saldo do cofrinho</div>
              <div className="text-2xl font-semibold tracking-tight">{money(pocket.balance)}</div>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => (editingBalance ? setEditingBalance(false) : startEditBalance())} title="Ajustar saldo">
              {editingBalance ? <X className="size-4" /> : <Pencil className="size-4" />}
            </Button>
          </div>

          {editingBalance && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" inputMode="decimal" step="0.01" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Desde quando</Label>
                  <Input type="date" value={balanceDateInput} onChange={(e) => setBalanceDateInput(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pra corrigir o saldo de hoje pra um valor certo (ex: conferindo com o extrato), use a data de hoje —
                assim não sobra nenhum depósito/resgate registrado no meio pra somar em cima.
              </p>
              <Button size="sm" onClick={saveBalance} disabled={savingBalance}>
                Salvar saldo
              </Button>
            </div>
          )}

          {hasGoal && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {pct!.toFixed(0)}% de {money(pocket.targetAmount!)}
                {pocket.targetDate && ` · prazo ${pocket.targetDate.slice(8, 10)}/${pocket.targetDate.slice(5, 7)}/${pocket.targetDate.slice(0, 4)}`}
              </p>
            </div>
          )}
        </div>

        {cdiEligible && (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36" />
              </div>
            </div>

            <div className="mb-6 rounded-xl border bg-card p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Rendimento — {pocket.cdiPercentage}% do CDI
                  {pocket.maturityDate
                    ? ` até ${pocket.maturityDate.slice(8, 10)}/${pocket.maturityDate.slice(5, 7)}/${pocket.maturityDate.slice(0, 4)}`
                    : " (sem vencimento)"}
                </div>
                {cdiYield && (
                  <span className="text-sm font-semibold text-primary">
                    +{money(cdiYield.value)} ({cdiYield.pct.toFixed(2)}%)
                  </span>
                )}
              </div>
              {loadingCdi ? (
                <Skeleton className="h-48 w-full" />
              ) : cdiChartData.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nada nesse período — ajuste o filtro de data acima.
                </p>
              ) : (
                <ChartContainer config={cdiChartConfig} className="aspect-auto h-56 w-full">
                  <RechartsLineChart data={cdiChartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`}
                    />
                    <YAxis tickLine={false} axisLine={false} width={40} domain={["dataMin - 10", "dataMax + 10"]} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `${String(v).slice(8, 10)}/${String(v).slice(5, 7)}/${String(v).slice(0, 4)}`} />} />
                    <Line dataKey="principal" type="monotone" stroke="var(--color-principal)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                    <Line dataKey="adjusted" type="monotone" stroke="var(--color-adjusted)" strokeWidth={2} dot={false} />
                  </RechartsLineChart>
                </ChartContainer>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Taxa diária real do CDI (Banco Central) composta dia a dia desde o saldo inicial — não é garantia, é o
                que teria rendido com a série publicada até agora. O ganho acima é o total desde o início; o filtro de
                data só recorta o que aparece no gráfico.
              </p>
            </div>
          </>
        )}

        {pocket.kind === "INVESTMENT" && !cdiEligible && (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            <p className="mb-2">Falta o %CDI pra calcular e mostrar o histórico de rendimento — vencimento é opcional.</p>
            <Button size="sm" variant="outline" render={<Link href={`/financeiro/metas?pocket=${pocketId}`} />}>
              Definir agora
            </Button>
          </div>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
}
