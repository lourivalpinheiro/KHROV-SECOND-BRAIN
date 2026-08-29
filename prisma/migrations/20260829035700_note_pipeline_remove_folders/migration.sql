-- Renomeia os valores do NoteType pro novo pipeline de 4 estágios
-- (RENAME VALUE preserva o OID interno — linhas existentes acompanham
-- automaticamente, sem precisar de UPDATE manual).
ALTER TYPE "NoteType" RENAME VALUE 'FLEETING' TO 'STIMULUS';
ALTER TYPE "NoteType" RENAME VALUE 'LITERATURE' TO 'POTENTIATION';
ALTER TYPE "NoteType" RENAME VALUE 'PERMANENT' TO 'SYNAPSE';
ALTER TYPE "NoteType" ADD VALUE 'ENGRAM';

-- AlterTable: novo default + síntese exigida pra promover a Sinapse
ALTER TABLE "Note" ALTER COLUMN "type" SET DEFAULT 'STIMULUS';
ALTER TABLE "Note" ADD COLUMN "synthesisText" TEXT;

-- Elimina pastas por completo (só grafo/backlinks + tags como organização)
ALTER TABLE "Note" DROP CONSTRAINT "Note_folderId_fkey";
DROP INDEX "Note_folderId_idx";
ALTER TABLE "Note" DROP COLUMN "folderId";

DROP TABLE "Folder";
DROP TYPE "ParaCategory";
