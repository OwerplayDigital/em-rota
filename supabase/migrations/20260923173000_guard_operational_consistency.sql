-- Prevent inconsistent operational states between the web app and Telegram.
-- A personal Em Rota account can have only one active journey at a time.

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_single_active
ON public.sessions ((status))
WHERE status = 'active';

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_end_after_start;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_end_after_start
  CHECK (end_time IS NULL OR end_time >= start_time);

ALTER TABLE public.work_days
  DROP CONSTRAINT IF EXISTS work_days_odometer_order;

ALTER TABLE public.work_days
  ADD CONSTRAINT work_days_odometer_order
  CHECK (
    odometer_start IS NULL
    OR odometer_end IS NULL
    OR odometer_end >= odometer_start
  );

ALTER TABLE public.work_days
  DROP CONSTRAINT IF EXISTS work_days_nonnegative_values;

ALTER TABLE public.work_days
  ADD CONSTRAINT work_days_nonnegative_values
  CHECK (
    COALESCE(total_earned, 0) >= 0
    AND COALESCE(uber_earned, 0) >= 0
    AND COALESCE(ifood_earned, 0) >= 0
    AND COALESCE(total_deliveries, 0) >= 0
    AND (daily_goal IS NULL OR daily_goal >= 0)
  );
