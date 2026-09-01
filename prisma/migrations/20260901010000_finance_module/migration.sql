-- Módulo Financeiro: saldo inicial, lançamentos (entradas, saídas,
-- economias, diário, cartão de crédito com parcelamento e recorrência),
-- tags e as "variáveis" livres que compõem a previsão de gasto diário.
CREATE TYPE "FinanceEntryType" AS ENUM ('INCOME', 'EXPENSE', 'SAVINGS', 'DAILY', 'CREDIT_CARD');
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE "SavingsDirection" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

CREATE TABLE "FinanceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startingBalanceDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceProfile_userId_key" ON "FinanceProfile"("userId");

ALTER TABLE "FinanceProfile" ADD CONSTRAINT "FinanceProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinanceSavingsPocket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION,
    "targetDate" DATE,
    "monthlyContribution" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSavingsPocket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceSavingsPocket_userId_name_key" ON "FinanceSavingsPocket"("userId", "name");
CREATE INDEX "FinanceSavingsPocket_userId_idx" ON "FinanceSavingsPocket"("userId");

ALTER TABLE "FinanceSavingsPocket" ADD CONSTRAINT "FinanceSavingsPocket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FinanceEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'NONE',
    "recurrenceEndDate" DATE,
    "installmentGroupId" TEXT,
    "installmentNumber" INTEGER,
    "installmentTotal" INTEGER,
    "pocketId" TEXT,
    "savingsDirection" "SavingsDirection" NOT NULL DEFAULT 'DEPOSIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceEntry_userId_date_idx" ON "FinanceEntry"("userId", "date");
CREATE INDEX "FinanceEntry_userId_type_idx" ON "FinanceEntry"("userId", "type");
CREATE INDEX "FinanceEntry_installmentGroupId_idx" ON "FinanceEntry"("installmentGroupId");
CREATE INDEX "FinanceEntry_pocketId_idx" ON "FinanceEntry"("pocketId");

ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_pocketId_fkey"
    FOREIGN KEY ("pocketId") REFERENCES "FinanceSavingsPocket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FinanceTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FinanceTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceTag_userId_name_key" ON "FinanceTag"("userId", "name");
CREATE INDEX "FinanceTag_userId_idx" ON "FinanceTag"("userId");

ALTER TABLE "FinanceTag" ADD CONSTRAINT "FinanceTag_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinanceEntryTag" (
    "entryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "FinanceEntryTag_pkey" PRIMARY KEY ("entryId", "tagId")
);

CREATE INDEX "FinanceEntryTag_tagId_idx" ON "FinanceEntryTag"("tagId");

ALTER TABLE "FinanceEntryTag" ADD CONSTRAINT "FinanceEntryTag_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceEntryTag" ADD CONSTRAINT "FinanceEntryTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "FinanceTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinanceBudgetVariable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBudgetVariable_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceBudgetVariable_userId_order_idx" ON "FinanceBudgetVariable"("userId", "order");

ALTER TABLE "FinanceBudgetVariable" ADD CONSTRAINT "FinanceBudgetVariable_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
