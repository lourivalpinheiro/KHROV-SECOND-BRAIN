-- Controle de sono: hora-alvo de dormir no perfil + um registro por
-- noite da hora que efetivamente foi dormir (ver /saude/sono).
ALTER TABLE "HealthProfile" ADD COLUMN "targetBedtimeMinutes" INTEGER;

CREATE TABLE "HealthSleepDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bedtimeMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthSleepDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthSleepDay_userId_date_key" ON "HealthSleepDay"("userId", "date");
CREATE INDEX "HealthSleepDay_userId_date_idx" ON "HealthSleepDay"("userId", "date");

ALTER TABLE "HealthSleepDay" ADD CONSTRAINT "HealthSleepDay_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
