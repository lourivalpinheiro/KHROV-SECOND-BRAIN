-- Rascunho de sessão (Córtex): não faz parte do pipeline de promoção
-- (Estímulo → Potenciação → Sinapse → Engrama). Só vira Estímulo de
-- verdade quando um trecho é extraído dela.
--
-- Em migration separada da do backfill de dados abaixo: Postgres não deixa
-- usar um valor de enum recém-adicionado na mesma transação que o criou.
ALTER TYPE "NoteType" ADD VALUE 'CORTEX';
