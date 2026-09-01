"use client";

import useSWR from "swr";
import Link from "next/link";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, PiggyBank, Target, Thermometer, Wallet } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Summary = {
  profile: unknown | null;
  currentBalance?: number;
  totalIncomeThisMonth?: number;
  totalExpenseThisMonth?: number;
  dailyAllowance?: number;
  spentToday?: number;
  remainingToday?: number;
};

function money(v: number | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

/**
 * Dashboard do módulo Financeiro: entradas/saídas do mês, saldo atual e a
 * previsão de gasto de hoje bem na frente. Sem orientação financeira aqui
 * — só soma e subtrai o que você registrou (ver src/lib/finance.ts).
 */
export default function FinanceiroDashboardPage() {
  const { data: summary, isLoading } = useSWR<Summary>("/api/finance/summary", fetcher);

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

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ArrowUpCircle className="size-4 text-primary" /> Entradas (mês)
            </div>
            <div className="text-2xl font-semibold tracking-tight">{money(summary.totalIncomeThisMonth)}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ArrowDownCircle className="size-4 text-destructive" /> Saídas (mês)
            </div>
            <div className="text-2xl font-semibold tracking-tight">{money(summary.totalExpenseThisMonth)}</div>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
              <Wallet className="size-4" /> Saldo atual
            </div>
            <div className="text-2xl font-semibold tracking-tight">{money(summary.currentBalance)}</div>
          </div>
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
