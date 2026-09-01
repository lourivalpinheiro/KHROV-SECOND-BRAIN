"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Settings2 } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WEEKDAY_LABELS_LONG } from "@/lib/spiritual";
import { toast } from "sonner";

type SpiritualProfile = { churchPlanDays: number[] } | null;

/** Só os dias planejados de ida à igreja por enquanto — base pro destaque na semana e pro streak. */
export default function PerfilEspiritualPage() {
  const { data: profile, isLoading } = useSWR<SpiritualProfile>("/api/spiritual/profile", fetcher);
  const [churchPlanDays, setChurchPlanDays] = useState<number[]>([0, 2, 4]);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!profile || loaded.current) return;
    loaded.current = true;
    setChurchPlanDays(profile.churchPlanDays);
  }, [profile]);

  function toggleDay(day: number) {
    setChurchPlanDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  }

  async function save() {
    setSaving(true);
    try {
      await patchJSON("/api/spiritual/profile", { churchPlanDays });
      await mutate("/api/spiritual/profile");
      await mutate("/api/spiritual/summary");
      toast.success("Perfil salvo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Settings2 className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Perfil espiritual</h1>
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-5">
          <div className="space-y-2">
            <Label>Dias planejados de ida à igreja</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS_LONG.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={
                    churchPlanDays.includes(day)
                      ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      : "rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Só pra destacar na tabela da semana e calcular o streak — a semana sempre mostra os 7 dias, marcar
              presença fora do plano nunca é bloqueado.
            </p>
          </div>

          <Button onClick={save} disabled={saving}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
