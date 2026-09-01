"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  LineChart,
  PiggyBank,
  Target,
  Thermometer,
  Wallet,
} from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toLocalDateKey } from "@/lib/finance";
import { cn } from "@/lib/utils";

type Summary = {
  profile: unknown | null;
  periodFrom?: string;
  periodTo?: string;
  currentCashBalance?: number;
  investmentBalance?: number;
  netWorth?: number;
  totalIncomeInPeriod?: number;
  totalExpenseInPeriod?: number;
  periodEndBalance?: number;
  dailyAllowance?: number;
  spentToday?: number;
  remainingToday?: number;
};

function money(v: number | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", highlight && "border-primary/30 bg-primary/5")}>
      <div className={cn("mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground", highlight && "text-primary")}>
        <Icon className={cn("size-4", accent)} /> {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function firstDayOfMonth(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
function lastDayOfMonth(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/**
 * Dashboard do módulo Financeiro: entradas/saídas/saldo final do período
 * filtrado numa linha, caixa/investido/patrimônio (sempre de hoje, não
 * filtrável) na outra, e a previsão de gasto de hoje embaixo. Sem
 * orientação financeira aqui — só soma e subtrai o que você registrou
 * (ver src/lib/finance.ts).
 */
export default function FinanceiroDashboardPage() {
  const now = new Date();
  const [fromDate, setFromDate] = useState(firstDayOfMonth(now));
  const [toDate, setToDate] = useState(lastDayOfMonth(now));
  const { data: summary, isLoading } = useSWR<Summary>(`/api/finance/summary?from=${fromDate}&to=${toDate}`, fetcher);

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <Skeleton className="h-64 w-full max-w-3xl rounded-xl" />
      </div>
    );
  }

  if (!summary?.profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Wallet className="size-8" />
        <p className="max-w-sm">Registre seu saldo atual pra começar a acompanhar entradas, saídas e previsão de gasto.</p>
        <Button render={<Link href="/financeiro/perfil" />}>Preencher perfil</Button>
      </div>
    );
  }

  const todayOver = (summary.remainingToday ?? 0) < 0;
  const dailyPct = summary.dailyAllowance
    ? Math.max(0, Math.min(100, ((summary.spentToday ?? 0) / summary.dailyAllowance) * 100))
    : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Wallet className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Financeiro — resumo</h1>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setFromDate(firstDayOfMonth(new Date()));
              setToDate(lastDayOfMonth(new Date()));
            }}
          >
            Mês atual
          </Button>
        </div>

        {/* Linha 1: entrada, saída, saldo final — do período filtrado */}
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <StatCard icon={ArrowUpCircle} label="Entradas (período)" value={money(summary.totalIncomeInPeriod)} accent="text-primary" />
          <StatCard icon={ArrowDownCircle} label="Saídas (período)" value={money(summary.totalExpenseInPeriod)} accent="text-destructive" />
          <StatCard
            icon={Wallet}
            label="Saldo final (período)"
            value={money(summary.periodEndBalance)}
            sub="projetado, considerando a previsão diária pros dias futuros"
            highlight
          />
        </div>

        {/* Linha 2: caixa, investido, patrimônio — sempre de hoje */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard icon={Wallet} label="Caixa atual" value={money(summary.currentCashBalance)} />
          <StatCard icon={LineChart} label="Investido" value={money(summary.investmentBalance)} sub="soma dos cofrinhos de investimento" />
          <StatCard icon={PiggyBank} label="Patrimônio total" value={money(summary.netWorth)} sub="caixa + investido" />
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Previsão de hoje</span>
            <span className={cn("text-sm font-semibold tabular-nums", todayOver ? "text-destructive" : "text-primary")}>
              {money(summary.remainingToday)} {todayOver ? "além do teto" : "disponível"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", todayOver ? "bg-destructive" : "bg-primary")}
              style={{ width: `${Math.min(100, dailyPct)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {money(summary.spentToday)} gastos hoje de {money(summary.dailyAllowance)} de teto (soma das variáveis ÷ 30) —
            zera à meia-noite.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/financeiro/lancamentos" />}>
            <ArrowLeftRight /> Lançamentos
          </Button>
          <Button variant="outline" render={<Link href="/financeiro/horizonte" />}>
            <Thermometer /> Horizonte
          </Button>
          <Button variant="outline" render={<Link href="/financeiro/cofrinhos" />}>
            <PiggyBank /> Cofrinhos
          </Button>
          <Button variant="outline" render={<Link href="/financeiro/metas" />}>
            <Target /> Metas
          </Button>
        </div>
      </div>
    </div>
  );
}
