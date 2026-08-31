-- Módulo Saúde: perfil (peso/altura/meta de água em garrafas/dias de
-- academia planejados) e um registro por dia (garrafas de água bebidas,
-- academia, notas de treino).
CREATE TABLE "HealthProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "waterGoalBottles" INTEGER NOT NULL DEFAULT 4,
    "gymPlanDays" INTEGER[] NOT NULL DEFAULT ARRAY[1,3,5]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthProfile_userId_key" ON "HealthProfile"("userId");

ALTER TABLE "HealthProfile" ADD CONSTRAINT "HealthProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HealthDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "waterBottles" INTEGER NOT NULL DEFAULT 0,
    "gym" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthDay_userId_date_key" ON "HealthDay"("userId", "date");
CREATE INDEX "HealthDay_userId_date_idx" ON "HealthDay"("userId", "date");

ALTER TABLE "HealthDay" ADD CONSTRAINT "HealthDay_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
