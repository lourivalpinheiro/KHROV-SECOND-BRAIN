-- Publicação de nota como página pública (sem login) — shareToken é
-- gerado uma vez e persiste entre publicar/despublicar; isPublished
-- controla se a rota pública serve ou não.
ALTER TABLE "Note" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Note" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Note_shareToken_key" ON "Note"("shareToken");
