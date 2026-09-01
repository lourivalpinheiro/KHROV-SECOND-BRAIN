"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Check, HandHeart, Plus, RotateCcw, Trash2 } from "lucide-react";
import { fetcher, patchJSON, postJSON, deleteJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PrayerRequest = {
  id: string;
  title: string;
  notes: string | null;
  status: "ACTIVE" | "ANSWERED";
  createdAt: string;
  answeredAt: string | null;
};

/** Pedidos de oração contínuos — ativos primeiro, respondidos ficam guardados embaixo (nunca some, só marca). */
export default function OracoesPage() {
  const { data: requests, isLoading } = useSWR<PrayerRequest[]>("/api/spiritual/prayer-requests", fetcher);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!title.trim()) return toast.error("Escreva o pedido.");
    setCreating(true);
    try {
      await postJSON("/api/spiritual/prayer-requests", { title: title.trim(), notes: notes.trim() || null });
      setTitle("");
      setNotes("");
      await mutate("/api/spiritual/prayer-requests");
      toast.success("Pedido adicionado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(r: PrayerRequest) {
    const nextStatus = r.status === "ACTIVE" ? "ANSWERED" : "ACTIVE";
    const optimistic = requests?.map((x) => (x.id === r.id ? { ...x, status: nextStatus } : x));
    mutate("/api/spiritual/prayer-requests", optimistic, { revalidate: false });
    try {
      await patchJSON(`/api/spiritual/prayer-requests/${r.id}`, { status: nextStatus });
      await mutate("/api/spiritual/prayer-requests");
    } catch {
      await mutate("/api/spiritual/prayer-requests");
    }
  }

  async function remove(id: string) {
    try {
      await deleteJSON(`/api/spiritual/prayer-requests/${id}`);
      await mutate("/api/spiritual/prayer-requests");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  }

  const active = (requests ?? []).filter((r) => r.status === "ACTIVE");
  const answered = (requests ?? []).filter((r) => r.status === "ANSWERED");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <HandHeart className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pedidos de oração</h1>
        </div>

        <div className="mb-6 space-y-2 rounded-xl border bg-card p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pelo que orar..." />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes (opcional)" rows={2} />
          <Button size="sm" onClick={create} disabled={creating}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : (requests ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum pedido ainda.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              {active.map((r) => (
                <RequestCard key={r.id} r={r} onToggle={toggleStatus} onRemove={remove} />
              ))}
              {active.length === 0 && <p className="text-sm text-muted-foreground">Nada ativo — tudo respondido!</p>}
            </div>

            {answered.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Respondidos</h2>
                <div className="space-y-2">
                  {answered.map((r) => (
                    <RequestCard key={r.id} r={r} onToggle={toggleStatus} onRemove={remove} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({
  r,
  onToggle,
  onRemove,
}: {
  r: PrayerRequest;
  onToggle: (r: PrayerRequest) => void;
  onRemove: (id: string) => void;
}) {
  const answered = r.status === "ANSWERED";
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-xl border bg-card p-3", answered && "opacity-70")}>
      <div className="min-w-0">
        <div className={cn("text-sm font-medium", answered && "line-through")}>{r.title}</div>
        {r.notes && <p className="mt-0.5 text-xs text-muted-foreground">{r.notes}</p>}
        {answered && r.answeredAt && (
          <p className="mt-1 text-xs text-primary">
            Respondido em {r.answeredAt.slice(8, 10)}/{r.answeredAt.slice(5, 7)}/{r.answeredAt.slice(0, 4)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title={answered ? "Reabrir" : "Marcar como respondido"}
          onClick={() => onToggle(r)}
        >
          {answered ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => onRemove(r.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
