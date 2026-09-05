-- Troca de Cloudflare R2 pro Supabase Storage — só renomeia a coluna que
-- guarda o caminho do objeto no bucket (o dado em si é opaco pro schema,
-- não muda de forma). Banco novo (Supabase), sem Attachment existente
-- pra migrar de verdade.
ALTER TABLE "Attachment" RENAME COLUMN "r2Key" TO "storageKey";
