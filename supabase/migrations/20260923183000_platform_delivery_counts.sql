ALTER TABLE public.work_days
  ADD COLUMN IF NOT EXISTS ifood_deliveries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uber_deliveries integer NOT NULL DEFAULT 0;

ALTER TABLE public.work_days
  DROP CONSTRAINT IF EXISTS work_days_platform_deliveries_nonnegative;

ALTER TABLE public.work_days
  ADD CONSTRAINT work_days_platform_deliveries_nonnegative
  CHECK (ifood_deliveries >= 0 AND uber_deliveries >= 0);

-- Registros historicos possuem apenas o total combinado. Mantemos os novos
-- contadores em zero para nao inventar uma divisao entre plataformas.
