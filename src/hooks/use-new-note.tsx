"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher, postJSON } from "@/lib/api-client";
import type { NoteListItem } from "@/types/models";
import { isEmptyStimulus, EMPTY_STIMULUS_NUDGE_AT } from "@/lib/note-health";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Criação de nota compartilhada por todo lugar que tem um botão "Nova
 * nota" (sidebar, /notes, Cmd+K) — pra virar aviso, não bloqueio, precisa
 * estar no mesmo lugar em todo canto, senão dá pra simplesmente clicar
 * noutro botão "Nova nota" e furar o aviso.
 *
 * A partir de EMPTY_STIMULUS_NUDGE_AT Estímulos vazios acumulados, criar
 * mais um primeiro mostra a lista deles — dá pra abrir um pra trabalhar
 * nele, ou seguir e criar mesmo assim. Nunca impede de verdade: captura
 * sem hesitar é o ponto do Estímulo, a fricção é só na promoção.
 */
export function useNewNote() {
  const router = useRouter();
  const { data: notes } = useSWR<NoteListItem[]>("/api/notes", fetcher);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const emptyStimuli = (notes ?? []).filter(isEmptyStimulus);

  async function create() {
    setCreating(true);
    try {
      const note = await postJSON<{ id: string }>("/api/notes", {});
      setOpen(false);
      router.push(`/notes/${note.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar nota.");
    } finally {
      setCreating(false);
    }
  }

  function requestCreate() {
    if (emptyStimuli.length >= EMPTY_STIMULUS_NUDGE_AT) {
      setOpen(true);
    } else {
      create();
    }
  }

  const gateDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Você tem {emptyStimuli.length} {emptyStimuli.length === 1 ? "Estímulo vazio" : "Estímulos vazios"}
          </DialogTitle>
          <DialogDescription>
            Criados mas nunca desenvolvidos. Que tal terminar algum antes de começar outro?
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {emptyStimuli.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/notes/${n.id}`);
              }}
              className="block w-full truncate rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              {n.title || "Nota sem título"}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={create} disabled={creating}>
            Criar mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestCreate, gateDialog, emptyStimuli };
}
