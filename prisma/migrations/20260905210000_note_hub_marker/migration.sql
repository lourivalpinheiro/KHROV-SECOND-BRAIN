-- Hub: marcador independente do pipeline de maturação — nota "índice de
-- assunto" cujos backlinks viram "sub-tópicos" na UI.
ALTER TABLE "Note" ADD COLUMN "isHub" BOOLEAN NOT NULL DEFAULT false;
