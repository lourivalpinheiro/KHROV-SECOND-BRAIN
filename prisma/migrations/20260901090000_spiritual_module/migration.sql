-- Módulo Espiritual: perfil (dias planejados de igreja), registro diário
-- (oração manhã/noite, devocional, presença na igreja), preparação de
-- sermões, pedidos de oração, progresso de leitura bíblica e versículos
-- pra memorizar (com repetição espaçada própria).

CREATE TYPE "SermonStatus" AS ENUM ('DRAFT', 'READY', 'PREACHED');
CREATE TYPE "PrayerRequestStatus" AS ENUM ('ACTIVE', 'ANSWERED');
CREATE TYPE "MemoryVerseStatus" AS ENUM ('LEARNING', 'MEMORIZED');

CREATE TABLE "SermonSeries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SermonSeries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SermonSeries_userId_idx" ON "SermonSeries"("userId");
ALTER TABLE "SermonSeries" ADD CONSTRAINT "SermonSeries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SpiritualProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "churchPlanDays" INTEGER[] DEFAULT ARRAY[0,2,4]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritualProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpiritualProfile_userId_key" ON "SpiritualProfile"("userId");
ALTER TABLE "SpiritualProfile" ADD CONSTRAINT "SpiritualProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SpiritualDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "prayerMorning" BOOLEAN NOT NULL DEFAULT false,
    "prayerNight" BOOLEAN NOT NULL DEFAULT false,
    "devotional" BOOLEAN NOT NULL DEFAULT false,
    "churchAttended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpiritualDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpiritualDay_userId_date_key" ON "SpiritualDay"("userId", "date");
CREATE INDEX "SpiritualDay_userId_date_idx" ON "SpiritualDay"("userId", "date");
ALTER TABLE "SpiritualDay" ADD CONSTRAINT "SpiritualDay_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Sermon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passage" TEXT,
    "status" "SermonStatus" NOT NULL DEFAULT 'DRAFT',
    "date" DATE,
    "content" JSONB NOT NULL,
    "seriesId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sermon_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Sermon_userId_status_idx" ON "Sermon"("userId", "status");
CREATE INDEX "Sermon_userId_date_idx" ON "Sermon"("userId", "date");
CREATE INDEX "Sermon_seriesId_order_idx" ON "Sermon"("seriesId", "order");
ALTER TABLE "Sermon" ADD CONSTRAINT "Sermon_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sermon" ADD CONSTRAINT "Sermon_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "SermonSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PrayerRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PrayerRequestStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "PrayerRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrayerRequest_userId_status_idx" ON "PrayerRequest"("userId", "status");
ALTER TABLE "PrayerRequest" ADD CONSTRAINT "PrayerRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BibleReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "book" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BibleReadingProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BibleReadingProgress_userId_book_chapter_key" ON "BibleReadingProgress"("userId", "book", "chapter");
CREATE INDEX "BibleReadingProgress_userId_idx" ON "BibleReadingProgress"("userId");
ALTER TABLE "BibleReadingProgress" ADD CONSTRAINT "BibleReadingProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MemoryVerse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "text" TEXT,
    "status" "MemoryVerseStatus" NOT NULL DEFAULT 'LEARNING',
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryVerse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MemoryVerse_userId_status_idx" ON "MemoryVerse"("userId", "status");
CREATE INDEX "MemoryVerse_userId_dueAt_idx" ON "MemoryVerse"("userId", "dueAt");
ALTER TABLE "MemoryVerse" ADD CONSTRAINT "MemoryVerse_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GratitudeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GratitudeEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GratitudeEntry_userId_date_key" ON "GratitudeEntry"("userId", "date");
CREATE INDEX "GratitudeEntry_userId_date_idx" ON "GratitudeEntry"("userId", "date");
ALTER TABLE "GratitudeEntry" ADD CONSTRAINT "GratitudeEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
