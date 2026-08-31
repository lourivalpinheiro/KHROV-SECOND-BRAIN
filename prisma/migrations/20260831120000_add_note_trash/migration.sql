-- Lixeira: soft delete de notas, com purga automática depois de 30 dias
-- (ver src/app/api/cron/purge-trash).
ALTER TABLE "Note" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Note_userId_deletedAt_idx" ON "Note"("userId", "deletedAt");
