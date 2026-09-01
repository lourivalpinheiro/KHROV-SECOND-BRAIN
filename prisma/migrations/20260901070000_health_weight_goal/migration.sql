-- Meta de peso opcional no perfil de Saúde — baseline congelado no
-- momento em que a meta é definida/muda (pra saber a direção: emagrecer
-- ou ganhar peso) e a data em que foi batida (ver HealthProfile no schema).
ALTER TABLE "HealthProfile" ADD COLUMN "targetWeightKg" DOUBLE PRECISION;
ALTER TABLE "HealthProfile" ADD COLUMN "targetWeightBaselineKg" DOUBLE PRECISION;
ALTER TABLE "HealthProfile" ADD COLUMN "targetWeightReachedAt" TIMESTAMP(3);
