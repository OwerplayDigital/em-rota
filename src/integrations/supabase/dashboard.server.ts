import { supabaseAdmin } from './client.server';
import { toCents, fromCents } from '@/lib/money';
import { getLocalDateString } from '@/lib/dashboard-utils';

export const getDashboardData = async (startDate: string, endDate: string) => {
  if (!startDate || !endDate) throw new Error("startDate and endDate are required");

  // Fetch most recent goal to maintain it until updated
  const { data: lastGoalRecord } = await supabaseAdmin
    .from('work_days')
    .select('daily_goal')
    .not('daily_goal', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const todayGoal = lastGoalRecord?.daily_goal || null;

  // Fetch work days in range
  const { data: workDays, error: wdError } = await supabaseAdmin
    .from('work_days')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (wdError) throw wdError;

  // Fetch all sessions for these work days
  const workDayIds = workDays.map(wd => wd.id);
  
  let sessions: any[] = [];
  if (workDayIds.length > 0) {
    const { data: sessData, error: sessError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .in('work_day_id', workDayIds)
      .eq('status', 'completed');
    
    if (sessError) throw sessError;
    sessions = sessData || [];
  }

  const { data: activeSession, error: activeSessionError } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();

  if (activeSessionError) throw activeSessionError;

  const { data: lastCompletedDay, error: lastCompletedError } = await supabaseAdmin
    .from('work_days')
    .select('*')
    .eq('status', 'completed')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastCompletedError) throw lastCompletedError;

  return {
    workDays,
    sessions,
    todayGoal,
    activeSession: activeSession ?? null,
    hasActiveSession: Boolean(activeSession),
    lastCompletedDay: lastCompletedDay ?? null,
  };
};

export const updateDailyGoal = async (goal: number) => {
  const todayStr = getLocalDateString();
  // Garante precisão monetária de centavos: NUMERIC(10,2)
  const goalRounded = fromCents(toCents(goal));
  
  // Update or insert for today
  const { data: existing } = await supabaseAdmin
    .from('work_days')
    .select('id')
    .eq('date', todayStr as any)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from('work_days')
      .update({ daily_goal: goalRounded })
      .eq('id', (existing as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from('work_days')
      .insert({ 
        date: todayStr, 
        daily_goal: goalRounded,
        status: 'in_progress' 
      } as any);
    if (error) throw error;
  }
  
  return { success: true };
};