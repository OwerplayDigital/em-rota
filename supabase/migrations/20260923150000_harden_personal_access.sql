-- Security hardening for the personal Em Rota dashboard.
-- The Telegram bot uses service_role server-side and continues to bypass RLS.
-- Interactive access is restricted to the single authorized account.

DROP POLICY IF EXISTS "Allow authenticated users full access to work_days" ON public.work_days;
DROP POLICY IF EXISTS "Allow authenticated users full access to sessions" ON public.sessions;
DROP POLICY IF EXISTS "Owner access to work_days" ON public.work_days;
DROP POLICY IF EXISTS "Owner access to sessions" ON public.sessions;

CREATE POLICY "Owner access to work_days"
ON public.work_days
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email') = 'owertech82@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'owertech82@gmail.com');

CREATE POLICY "Owner access to sessions"
ON public.sessions
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email') = 'owertech82@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'owertech82@gmail.com');

REVOKE ALL ON public.work_days FROM anon;
REVOKE ALL ON public.sessions FROM anon;
