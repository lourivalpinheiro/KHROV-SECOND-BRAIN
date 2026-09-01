-- Rentabilidade indexada ao CDI por cofrinho — só entra em ação quando os
-- dois campos estão preenchidos (ver /api/finance/pockets/[id]/cdi).
ALTER TABLE "FinanceSavingsPocket" ADD COLUMN "cdiPercentage" DOUBLE PRECISION;
ALTER TABLE "FinanceSavingsPocket" ADD COLUMN "maturityDate" DATE;

-- Exclusão de uma ocorrência isolada de um lançamento recorrente, sem
-- mexer no resto da série (ver excludedDates em FinanceEntry).
ALTER TABLE "FinanceEntry" ADD COLUMN "excludedDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
