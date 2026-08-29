-- Notas diárias existentes que ainda estão no default (Estímulo) viram
-- Córtex — o valor que passam a nascer com daqui pra frente. Não mexe em
-- nenhuma nota diária que o usuário já promoveu manualmente pra um estágio
-- do pipeline (esse gesto continua valendo).
UPDATE "Note"
SET "type" = 'CORTEX'
WHERE "dailyDate" IS NOT NULL AND "type" = 'STIMULUS';
