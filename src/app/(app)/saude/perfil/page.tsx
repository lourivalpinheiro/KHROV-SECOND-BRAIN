"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Settings2 } from "lucide-react";
import { fetcher, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAY_LABELS_LONG, suggestWaterGoalBottles } from "@/lib/health";
import { toast } from "sonner";

type HealthProfile = {
  weightKg: number;
  heightCm: number;
  waterGoalBottles: number;
  gymPlanDays: number[];
} | null;

/**
 * Onde entram peso, altura, meta de água (em garrafas de 1L) e os dias
 * planejados de academia — a base pra tudo mais no módulo (streaks,
 * calorias, tabela da semana).
 */
export default function PerfilSaudePage() {
  const { data: profile, isLoading } = useSWR<HealthProfile>("/api/health/profile", fetcher);
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [waterGoalBottles, setWaterGoalBottles] = useState("4");
  const [gymPlanDays, setGymPlanDays] = useState<number[]>([1, 3, 5]);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!profile || loaded.current) return;
    loaded.current = true;
    setWeightKg(String(profile.weightKg));
    setHeightCm(String(profile.heightCm));
    setWaterGoalBottles(String(profile.waterGoalBottles));
    setGymPlanDays(profile.gymPlanDays);
  }, [profile]);

  function toggleDay(day: number) {
    setGymPlanDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  }

  async function save() {
    const weight = Number(weightKg);
    const height = Number(heightCm);
    const bottles = Number(waterGoalBottles);
    if (!weight || weight <= 0) {
      toast.error("Peso inválido.");
      return;
    }
    if (!height || height <= 0) {
      toast.error("Altura inválida.");
      return;
    }
    if (!Number.isInteger(bottles) || bottles <= 0) {
      toast.error("Meta de água inválida.");
      return;
    }
    setSaving(true);
    try {
      await patchJSON("/api/health/profile", {
        weightKg: weight,
        heightCm: height,
        waterGoalBottles: bottles,
        gymPlanDays,
      });
      await mutate("/api/health/profile");
      await mutate("/api/health/summary");
      toast.success("Perfil salvo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  const weightNum = Number(weightKg);
  const suggestedBottles = weightNum > 0 ? suggestWaterGoalBottles(weightNum) : null;

  if (isLoading) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <Settings2 className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Perfil de saúde</h1>
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="Ex: 115"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Altura (cm)</Label>
              <Input
                id="height"
                type="number"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="Ex: 183"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="water-goal">Meta de água (garrafas de 1L/dia)</Label>
            <Input
              id="water-goal"
              type="number"
              inputMode="numeric"
              min={1}
              value={waterGoalBottles}
              onChange={(e) => setWaterGoalBottles(e.target.value)}
              className="w-24"
            />
            {suggestedBottles && (
              <p className="text-xs text-muted-foreground">
                Regra geral pro seu peso (~35ml/kg) sugere ~{suggestedBottles}{" "}
                {suggestedBottles === 1 ? "garrafa" : "garrafas"} — não é orientação médica, ajuste como preferir.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Dias planejados de academia</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS_LONG.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={
                    gymPlanDays.includes(day)
                      ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      : "rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Só pra destacar na tabela da semana e calcular o streak — a tabela sempre mostra os 7 dias, marcar um dia
              fora do plano nunca é bloqueado.
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
