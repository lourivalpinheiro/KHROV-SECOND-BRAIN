-- AlterTable
ALTER TABLE "FinanceProfile" ALTER COLUMN "startingBalanceDate" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "NoteStageHistory" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "stage" "NoteType" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteStageHistory_noteId_createdAt_idx" ON "NoteStageHistory"("noteId", "createdAt");

-- AddForeignKey
ALTER TABLE "NoteStageHistory" ADD CONSTRAINT "NoteStageHistory_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
