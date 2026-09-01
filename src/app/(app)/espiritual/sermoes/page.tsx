"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { BookOpenText, ChevronRight, Layers, Plus } from "lucide-react";
import { fetcher, postJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SERMON_STATUS_LABELS } from "@/lib/spiritual";
import { toast } from "sonner";

type SermonListItem = {
  id: string;
  title: string;
  passage: string | null;
  status: "DRAFT" | "READY" | "PREACHED";
  date: string | null;
  order: number;
  seriesId: string | null;
  series: { id: string; title: string } | null;
};

type Series = { id: string; title: string; description: string | null; sermonCount: number };

const NO_SERIES = "__none__";

function StatusBadge({ status }: { status: SermonListItem["status"] }) {
  const styles: Record<string, string> = {
    DRAFT: "border-muted-foreground/30 text-muted-foreground",
    READY: "border-primary/40 text-primary",
    PREACHED: "border-primary bg-primary/10 text-primary",
  };
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${styles[status]}`}>
      {SERMON_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Lista de sermões, agrupados por série (ex: "Provérbios em 6 partes" —
 * mesmo texto/tema pregado várias vezes) — os avulsos ficam num grupo à
 * parte no fim. Pregação expositiva parte do texto, por isso a passagem
 * aparece junto do título em toda a listagem.
 */
export default function SermoesPage() {
  const router = useRouter();
  const { data: sermons, isLoading } = useSWR<SermonListItem[]>("/api/spiritual/sermons", fetcher);
  const { data: series } = useSWR<Series[]>("/api/spiritual/sermon-series", fetcher);

  const [showNewSermon, setShowNewSermon] = useState(false);
  const [title, setTitle] = useState("");
  const [passage, setPassage] = useState("");
  const [seriesId, setSeriesId] = useState(NO_SERIES);
  const [creating, setCreating] = useState(false);

  const [showNewSeries, setShowNewSeries] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [creatingSeries, setCreatingSeries] = useState(false);

  async function createSermon() {
    if (!title.trim()) return toast.error("Dê um título pro sermão.");
    if (!passage.trim()) return toast.error("Pregação expositiva parte do texto — informe a passagem.");
    setCreating(true);
    try {
      const created = await postJSON<{ id: string }>("/api/spiritual/sermons", {
        title: title.trim(),
        passage: passage.trim(),
        seriesId: seriesId === NO_SERIES ? null : seriesId,
      });
      setShowNewSermon(false);
      setTitle("");
      setPassage("");
      setSeriesId(NO_SERIES);
      await mutate("/api/spiritual/sermons");
      router.push(`/espiritual/sermoes/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar sermão.");
    } finally {
      setCreating(false);
    }
  }

  async function createSeries() {
    if (!seriesTitle.trim()) return toast.error("Dê um título pra série.");
    setCreatingSeries(true);
    try {
      const created = await postJSON<{ id: string }>("/api/spiritual/sermon-series", {
        title: seriesTitle.trim(),
        description: seriesDescription.trim() || null,
      });
      setSeriesTitle("");
      setSeriesDescription("");
      setShowNewSeries(false);
      await mutate("/api/spiritual/sermon-series");
      setSeriesId(created.id);
      toast.success("Série criada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar série.");
    } finally {
      setCreatingSeries(false);
    }
  }

  const grouped = (() => {
    const bySeriesId = new Map<string, SermonListItem[]>();
    const loose: SermonListItem[] = [];
    for (const s of sermons ?? []) {
      if (s.seriesId) {
        const list = bySeriesId.get(s.seriesId) ?? [];
        list.push(s);
        bySeriesId.set(s.seriesId, list);
      } else {
        loose.push(s);
      }
    }
    return { bySeriesId, loose };
  })();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpenText className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sermões</h1>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowNewSeries(true)}>
              <Layers /> Nova série
            </Button>
            <Button size="sm" onClick={() => setShowNewSermon(true)}>
              <Plus /> Novo sermão
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !sermons || sermons.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum sermão ainda — crie um acima pra começar a preparar.
          </div>
        ) : (
          <div className="space-y-6">
            {(series ?? [])
              .filter((s) => grouped.bySeriesId.has(s.id))
              .map((s) => (
                <div key={s.id}>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Layers className="size-3.5 text-primary" /> {s.title}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {s.sermonCount} {s.sermonCount === 1 ? "parte" : "partes"}
                    </span>
                  </div>
                  {s.description && <p className="mb-2 text-xs text-muted-foreground">{s.description}</p>}
                  <div className="space-y-2">
                    {grouped.bySeriesId
                      .get(s.id)!
                      .sort((a, b) => a.order - b.order)
                      .map((sermon, i) => (
                        <SermonRow key={sermon.id} sermon={sermon} partLabel={`Parte ${i + 1}`} />
                      ))}
                  </div>
                </div>
              ))}

            {grouped.loose.length > 0 && (
              <div>
                {(series?.length ?? 0) > 0 && <div className="mb-2 text-sm font-semibold text-muted-foreground">Avulsos</div>}
                <div className="space-y-2">
                  {grouped.loose.map((sermon) => (
                    <SermonRow key={sermon.id} sermon={sermon} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showNewSermon} onOpenChange={setShowNewSermon}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo sermão</DialogTitle>
            <DialogDescription>
              Pregação expositiva parte do texto — título e passagem são obrigatórios, o resto se escreve na página do
              sermão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: A fidelidade de Deus" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Passagem</Label>
              <Input value={passage} onChange={(e) => setPassage(e.target.value)} placeholder="Ex: Romanos 8:28-30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Série (opcional)</Label>
              <Select value={seriesId} onValueChange={(v) => setSeriesId(v ?? NO_SERIES)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>{() => (seriesId === NO_SERIES ? "Sem série" : series?.find((s) => s.id === seriesId)?.title ?? "Sem série")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SERIES}>Sem série</SelectItem>
                  {(series ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSermon(false)}>
              Cancelar
            </Button>
            <Button onClick={createSermon} disabled={creating}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewSeries} onOpenChange={setShowNewSeries}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova série</DialogTitle>
            <DialogDescription>
              Pra quando o mesmo texto ou tema vai render mais de uma pregação — ex: 3 sermões sobre o mesmo capítulo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título da série</Label>
              <Input value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} placeholder="Ex: Romanos 8 em 3 partes" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={seriesDescription} onChange={(e) => setSeriesDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSeries(false)}>
              Cancelar
            </Button>
            <Button onClick={createSeries} disabled={creatingSeries}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SermonRow({ sermon, partLabel }: { sermon: SermonListItem; partLabel?: string }) {
  return (
    <Link
      href={`/espiritual/sermoes/${sermon.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {partLabel && <span className="text-xs font-medium text-primary">{partLabel} ·</span>}
          <span className="truncate text-sm font-medium">{sermon.title}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {sermon.passage && <span className="truncate">{sermon.passage}</span>}
          {sermon.date && <span>· {sermon.date.slice(8, 10)}/{sermon.date.slice(5, 7)}/{sermon.date.slice(0, 4)}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={sermon.status} />
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
