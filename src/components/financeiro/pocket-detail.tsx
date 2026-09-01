"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowLeft, ChevronLeft, ChevronRight, LineChart, PiggyBank, Settings2, Trash2 } from "lucide-react";
import { fetcher, deleteJSON } from "@/lib/api-client";
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
  targetAmount: number | null;
  targetDate: string | null;
  monthlyContribution: number | null;
};

type EntryRow = {
  id: string;
  occurrenceDate: string;
  description: string;
  amount: number;
  savingsDirection: "DEPOSIT" | "WITHDRAWAL";
};

const PAGE_SIZE = 10;

const chartConfig = {
  deposits: { label: "Depósitos", color: "var(--primary)" },
  withdrawals: { label: "Resgates", color: "var(--destructive)" },
} satisfies ChartConfig;

function money(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PocketDetail({ pocketId }: { pocketId: string }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [fromDate, setFromDate] = useState(toLocalDateKey(oneYearAgo));
  const [toDate, setToDate] = useState(toLocalDateKey(new Date()));
  const [page, setPage] = useState(0);

  const { data: pocket, isLoading: loadingPocket } = useSWR<Pocket>(`/api/finance/pockets/${pocketId}`, fetcher);
  const entriesQuery = `/api/finance/entries?pocketId=${pocketId}&from=${fromDate}&to=${toDate}`;
  const { data: entries, isLoading: loadingEntries } = useSWR<EntryRow[]>(entriesQuery, fetcher);

  const chartData = useMemo(() => {
    if (!entries) return [];
    const byMonth = new Map<string, { month: string; deposits: number; withdrawals: number }>();
    for (const e of entries) {
      const key = e.occurrenceDate.slice(0, 7);
      const bucket = byMonth.get(key) ?? { month: key, deposits: 0, withdrawals: 0 };
      if (e.savingsDirection === "WITHDRAWAL") bucket.withdrawals += e.amount;
      else bucket.deposits += e.amount;
      byMonth.set(key, bucket);
    }
    return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  const paginated = useMemo(() => {
    const sorted = entries ?? [];
    return sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  }, [entries, page]);
  const totalPages = Math.max(1, Math.ceil((entries?.length ?? 0) / PAGE_SIZE));

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
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
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
          <div className="text-xs font-medium text-muted-foreground">Saldo do cofrinho</div>
          <div className="text-2xl font-semibold tracking-tight">{money(pocket.balance)}</div>
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

        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} className="h-8 w-36" />
          </div>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="mb-3 text-xs font-medium text-muted-foreground">Histórico de entradas e saídas</div>
          {loadingEntries ? (
            <Skeleton className="h-48 w-full" />
          ) : chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nada nesse período.</p>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
              <BarChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: string) => {
                    const [y, m] = v.split("-");
                    return `${m}/${y.slice(2)}`;
                  }}
                />
                <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="deposits" fill="var(--color-deposits)" radius={2} />
                <Bar dataKey="withdrawals" fill="var(--color-withdrawals)" radius={2} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">Lançamentos</div>
          {loadingEntries ? (
            <div className="p-4">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : paginated.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nada nesse período.</p>
          ) : (
            <div className="divide-y">
              {paginated.map((e) => (
                <div key={e.id + e.occurrenceDate} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.occurrenceDate.slice(8, 10)}/{e.occurrenceDate.slice(5, 7)}/{e.occurrenceDate.slice(0, 4)} ·{" "}
                      {e.savingsDirection === "DEPOSIT" ? "Depósito" : "Resgate"}
                    </div>
                  </div>
                  <span className={e.savingsDirection === "DEPOSIT" ? "font-semibold text-primary" : "font-semibold text-destructive"}>
                    {e.savingsDirection === "DEPOSIT" ? "+" : "-"}
                    {money(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
              <span>
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="size-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
