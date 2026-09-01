-- Renomeia o saldo inicial do perfil pra "de caixa" (é o único que a
-- projeção/horizonte usa) e prepara os cofrinhos pra também guardar
-- investimento: todo investimento precisa morar dentro de um cofrinho
-- (kind=INVESTMENT), nunca um número solto no perfil.
ALTER TABLE "FinanceProfile" RENAME COLUMN "startingBalance" TO "startingCashBalance";

CREATE TYPE "PocketKind" AS ENUM ('SAVINGS', 'INVESTMENT');

ALTER TABLE "FinanceSavingsPocket" ADD COLUMN "kind" "PocketKind" NOT NULL DEFAULT 'SAVINGS';
ALTER TABLE "FinanceSavingsPocket" ADD COLUMN "startingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FinanceSavingsPocket" ADD COLUMN "startingBalanceDate" DATE;
