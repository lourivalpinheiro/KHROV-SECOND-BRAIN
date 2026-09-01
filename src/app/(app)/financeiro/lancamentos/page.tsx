"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { ArrowLeftRight, Plus, Repeat, Trash2, X } from "lucide-react";
import { fetcher, postJSON, deleteJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/hooks/use-confirm";
import {
  ENTRY_TYPE_LABELS,
  RECURRENCE_LABELS,
  toLocalDateKey,
  type EntryType,
  type RecurrenceKind,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type EntryRow = {
  id: string;
  occurrenceDate: string;
  type: EntryType;
  description: string;
  amount: number;
  recurrence: RecurrenceKind;
  isRecurringOccurrence: boolean;
  installmentNumber: number | null;
  installmentTotal: number | null;
  pocketId: string | null;
  pocketName: string | null;
  savingsDirection: "DEPOSIT" | "WITHDRAWAL";
  tags: { id: string; name: string }[];
};

type Pocket = { id: string; name: string };
type FinanceTagDTO = { id: string; name: string };

const ENTRY_TYPES: EntryType[] = ["INCOME", "EXPENSE", "SAVINGS", "DAILY", "CREDIT_CARD"];
const RECURRENCES: RecurrenceKind[] = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

function money(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function firstDayOfMonth(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
function lastDayOfMonth(d: Date) {
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// Saídas de verdade (dinheiro saindo) — pra colorir o valor na lista.
const OUTFLOW_TYPES = new Set<EntryType>(["EXPENSE", "DAILY", "CREDIT_CARD"]);

export default function LancamentosPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const now = new Date();
  const [fromDate, setFromDate] = useState(firstDayOfMonth(now));
  const [toDate, setToDate] = useState(lastDayOfMonth(now));
  const [typeFilter, setTypeFilter] = useState<"ALL" | EntryType>("ALL");
  const [showForm, setShowForm] = useState(false);

  const query = `/api/finance/entries?from=${fromDate}&to=${toDate}${typeFilter !== "ALL" ? `&type=${typeFilter}` : ""}`;
  const { data: entries, isLoading } = useSWR<EntryRow[]>(query, fetcher);
  const { data: pockets } = useSWR<Pocket[]>("/api/finance/pockets", fetcher);
  const { data: tags } = useSWR<FinanceTagDTO[]>("/api/finance/tags", fetcher);

  const totals = useMemo(() => {
    if (!entries) return { income: 0, outflow: 0 };
    let income = 0;
    let outflow = 0;
    for (const e of entries) {
      if (e.type === "INCOME" || (e.type === "SAVINGS" && e.savingsDirection === "WITHDRAWAL")) income += e.amount;
      else if (OUTFLOW_TYPES.has(e.type) || e.type === "SAVINGS") outflow += e.amount;
    }
    return { income, outflow };
  }, [entries]);

  async function removeEntry(entry: EntryRow) {
    const ok = await confirm({
      title: `Excluir "${entry.description}"?`,
      description: entry.isRecurringOccurrence
        ? "Esse lançamento se repete — excluir remove a série inteira (passado e futuro), não só essa ocorrência."
        : "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteJSON(`/api/finance/entries/${entry.id}`);
      await mutate(query);
      await mutate("/api/finance/summary");
      await mutate((key) => typeof key === "string" && key.startsWith("/api/finance/horizon"));
      toast.success("Lançamento excluído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Lançamentos</h1>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X /> : <Plus />} {showForm ? "Fechar" : "Novo"}
          </Button>
        </div>

        {showForm && (
          <NewEntryForm
            pockets={pockets ?? []}
            tags={tags ?? []}
            onCreated={async () => {
              setShowForm(false);
              await mutate(query);
              await mutate("/api/finance/summary");
              await mutate("/api/finance/pockets");
              await mutate((key) => typeof key === "string" && key.startsWith("/api/finance/horizon"));
            }}
          />
        )}

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v as "ALL" | EntryType) ?? "ALL")}>
              <SelectTrigger size="sm" className="h-8 w-40">
                <SelectValue>{() => (typeFilter === "ALL" ? "Todos" : ENTRY_TYPE_LABELS[typeFilter])}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {ENTRY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ENTRY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-4 text-sm">
            <span className="text-primary">+{money(totals.income)}</span>
            <span className="text-destructive">-{money(totals.outflow)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !entries || entries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum lançamento nesse período.
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e) => {
              const isInflow = e.type === "INCOME" || (e.type === "SAVINGS" && e.savingsDirection === "WITHDRAWAL");
              return (
                <div key={`${e.id}-${e.occurrenceDate}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{e.description}</span>
                      {e.isRecurringOccurrence && (
                        <span title="Recorrente">
                          <Repeat className="size-3 shrink-0 text-muted-foreground" />
                        </span>
                      )}
                      {e.installmentTotal && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {e.installmentNumber}/{e.installmentTotal}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{e.occurrenceDate.slice(8, 10)}/{e.occurrenceDate.slice(5, 7)}</span>
                      <span>· {ENTRY_TYPE_LABELS[e.type]}</span>
                      {e.pocketName && <span>· {e.pocketName}</span>}
                      {e.tags.map((t) => (
                        <span key={t.id} className="rounded-full bg-muted px-1.5 py-0.5">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("text-sm font-semibold tabular-nums", isInflow ? "text-primary" : "text-destructive")}>
                      {isInflow ? "+" : "-"}
                      {money(e.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEntry(e)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
}

function NewEntryForm({
  pockets,
  tags,
  onCreated,
}: {
  pockets: Pocket[];
  tags: FinanceTagDTO[];
  onCreated: () => void;
}) {
  const [type, setType] = useState<EntryType>("EXPENSE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => toLocalDateKey(new Date()));
  const [recurrence, setRecurrence] = useState<RecurrenceKind>("NONE");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [installments, setInstallments] = useState("1");
  const [pocketId, setPocketId] = useState<string>("");
  const [savingsDirection, setSavingsDirection] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false);

  const isCreditCard = type === "CREDIT_CARD";
  const isSavings = type === "SAVINGS";
  const installmentsNum = Math.max(1, Math.min(60, Number(installments) || 1));

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const created = await postJSON<FinanceTagDTO>("/api/finance/tags", { name });
      setNewTagName("");
      await mutate("/api/finance/tags");
      setSelectedTagIds((prev) => [...prev, created.id]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar tag.");
    }
  }

  async function submit() {
    const amountNum = Number(amount);
    if (!description.trim()) {
      toast.error("Descrição é obrigatória.");
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    setSaving(true);
    try {
      await postJSON("/api/finance/entries", {
        type,
        description: description.trim(),
        amount: amountNum,
        date,
        recurrence: installmentsNum > 1 ? "NONE" : recurrence,
        recurrenceEndDate: recurrenceEndDate || null,
        installments: isCreditCard ? installmentsNum : 1,
        pocketId: isSavings && pocketId ? pocketId : null,
        savingsDirection: isSavings ? savingsDirection : undefined,
        tagIds: selectedTagIds,
      });
      toast.success("Lançamento criado.");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 space-y-4 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType((v as EntryType) ?? "EXPENSE")}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue>{() => ENTRY_TYPE_LABELS[type]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ENTRY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTRY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <Label className="text-xs">{isCreditCard && installmentsNum > 1 ? "Valor total" : "Valor (R$)"}</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{isCreditCard ? "1º vencimento" : "Data"}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {isCreditCard ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Parcelas</Label>
            <Input type="number" min={1} max={60} value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs">Repete</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence((v as RecurrenceKind) ?? "NONE")}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue>{() => RECURRENCE_LABELS[recurrence]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RECURRENCES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {RECURRENCE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mercado, Salário, Aluguel..." />
      </div>

      {!isCreditCard && recurrence !== "NONE" && (
        <div className="max-w-56 space-y-1.5">
          <Label className="text-xs">Repete até (opcional)</Label>
          <Input type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} />
        </div>
      )}

      {isCreditCard && installmentsNum > 1 && (
        <p className="text-xs text-muted-foreground">
          {installmentsNum}x de R$ {(Number(amount) / installmentsNum || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          , uma por mês a partir da data acima.
        </p>
      )}

      {isSavings && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cofrinho (opcional)</Label>
            <Select value={pocketId || "none"} onValueChange={(v) => setPocketId(v === "none" ? "" : (v ?? ""))}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue>{() => pockets.find((p) => p.id === pocketId)?.name ?? "Nenhum"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {pockets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Direção</Label>
            <Select value={savingsDirection} onValueChange={(v) => setSavingsDirection((v as "DEPOSIT" | "WITHDRAWAL") ?? "DEPOSIT")}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue>{() => (savingsDirection === "DEPOSIT" ? "Depósito (guardar)" : "Resgate (tirar)")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEPOSIT">Depósito (guardar)</SelectItem>
                <SelectItem value="WITHDRAWAL">Resgate (tirar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Tags</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTag(t.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs transition-colors",
                selectedTagIds.includes(t.id) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
            >
              {t.name}
            </button>
          ))}
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createTag();
              }
            }}
            placeholder="+ nova tag"
            className="h-6 w-24 px-2 text-xs"
          />
        </div>
      </div>

      <Button onClick={submit} disabled={saving}>
        Criar lançamento
      </Button>
    </div>
  );
}
