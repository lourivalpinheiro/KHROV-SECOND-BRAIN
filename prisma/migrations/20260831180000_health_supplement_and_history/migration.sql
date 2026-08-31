-- Módulo Saúde: checkbox de suplementação por dia (igual academia) e
-- histórico de snapshots do perfil (peso/altura/metas), pra comparar
-- evolução ao longo do tempo já que a semana em si reseta toda segunda.
ALTER TABLE "HealthDay" ADD COLUMN "supplement" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "HealthProfileHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "waterGoalBottles" INTEGER NOT NULL,
    "gymPlanDays" INTEGER[],
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthProfileHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HealthProfileHistory_userId_recordedAt_idx" ON "HealthProfileHistory"("userId", "recordedAt");

ALTER TABLE "HealthProfileHistory" ADD CONSTRAINT "HealthProfileHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
