"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { ChevronLeft, ChevronRight, HeartHandshake, Plus, X } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toLocalDateKey, WEEKDAY_LABELS_LONG } from "@/lib/spiritual";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type GratitudeEntry = { id: string; date: string; items: string[] };

function addDays(dateKey: string, delta: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return toLocalDateKey(date);
}

function formatHeading(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_LABELS_LONG[date.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/**
 * Diário de gratidão: um dia por vez (navegável, como o registro de
 * sono), lista livre do que se é grato — adiciona/remove item, salva na
 * hora. Abaixo, as últimas entradas pra folhear rapidinho.
 */
export default function GratidaoEspiritualPage() {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: recent, isLoading } = useSWR<GratitudeEntry[]>("/api/spiritual/gratitude", fetcher);
  const current = recent?.find((e) => e.date === dateKey);
  const items = current?.items ?? [];
  const isToday = dateKey === toLocalDateKey(new Date());

  async function saveItems(nextItems: string[]) {
    setSaving(true);
    const optimistic = current
      ? recent!.map((e) => (e.date === dateKey ? { ...e, items: nextItems } : e))
      : [...(recent ?? []), { id: `temp-${dateKey}`, date: dateKey, items: nextItems }];
    mutate("/api/spiritual/gratitude", optimistic, { revalidate: false });
    try {
      await patchJSON("/api/spiritual/gratitude", { date: dateKey, items: nextItems });
      await mutate("/api/spiritual/gratitude");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
      await mutate("/api/spiritual/gratitude");
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    const text = draft.trim();
    if (!text) return;
    if (items.length >= 20) {
      toast.error("Limite de 20 itens por dia.");
      return;
    }
    setDraft("");
    saveItems([...items, text]);
  }

  function removeItem(index: number) {
    saveItems(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <HeartHandshake className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Diário de gratidão</h1>
        </div>

        <div className="mb-6 rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setDateKey((k) => addDays(k, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-40 text-center text-sm font-medium">
                {formatHeading(dateKey)}
                {isToday && <span className="ml-1.5 text-xs text-primary">(hoje)</span>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={isToday}
                onClick={() => setDateKey((k) => addDays(k, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">Do que você é grato hoje?</p>
              {items.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <span className="flex-1">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        title="Remover"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="Ex: uma conversa boa, um problema resolvido..."
                />
                <Button size="sm" onClick={addItem} disabled={saving || !draft.trim()}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {(recent ?? []).filter((e) => e.date !== dateKey && e.items.length > 0).length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Últimas entradas</h2>
            <div className="space-y-2">
              {recent!
                .filter((e) => e.date !== dateKey && e.items.length > 0)
                .slice(0, 14)
                .map((e) => (
                  <button
                    key={e.date}
                    type="button"
                    onClick={() => setDateKey(e.date)}
                    className={cn(
                      "block w-full rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40"
                    )}
                  >
                    <div className="mb-1 text-xs font-medium text-muted-foreground">{formatHeading(e.date)}</div>
                    <ul className="space-y-0.5 text-sm">
                      {e.items.map((item, i) => (
                        <li key={i} className="truncate">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
