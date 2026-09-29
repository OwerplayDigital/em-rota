-- Track odometer per journey so personal riding between work sessions is excluded.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS odometer_start NUMERIC,
  ADD COLUMN IF NOT EXISTS odometer_end NUMERIC;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_odometer_order
  CHECK (odometer_start IS NULL OR odometer_end IS NULL OR odometer_end >= odometer_start);

-- Preserve historical single-session/day data when possible.
UPDATE public.sessions s
SET odometer_start = wd.odometer_start,
    odometer_end = wd.odometer_end
FROM public.work_days wd
WHERE s.work_day_id = wd.id
  AND (SELECT count(*) FROM public.sessions x WHERE x.work_day_id = wd.id) = 1
  AND s.odometer_start IS NULL
  AND s.odometer_end IS NULL;
