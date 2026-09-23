import { format, subDays, startOfDay, endOfDay, startOfMonth, startOfYear } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toCents, fromCents } from './money';

const TIMEZONE = 'America/Sao_Paulo';

export const getLocalDateString = (date: Date = new Date()) => {
  const zonedDate = toZonedTime(date, TIMEZONE);
  return format(zonedDate, 'yyyy-MM-dd');
};

export const getDatesForPeriod = (period: string) => {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  
  let start: Date;
  let end: Date = endOfDay(zonedNow);

  switch (period) {
    case 'Hoje':
      start = startOfDay(zonedNow);
      break;
    case '7 dias':
      start = startOfDay(subDays(zonedNow, 6));
      break;
    case 'Este mês':
      start = startOfMonth(zonedNow);
      break;
    case 'Este ano':
      start = startOfYear(zonedNow);
      break;
    default:
      start = startOfDay(zonedNow);
  }

  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
};

export const formatDateBR = (dateStr: string) => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export const formatTimeBR = (date: string | Date) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

export const formatDuration = (ms: number) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const calculateMetrics = (workDays: any[], sessions: any[]) => {
  const totalEarnedCents = workDays.reduce((acc, wd) => acc + toCents(wd.total_earned), 0);
  const totalUberCents = workDays.reduce((acc, wd) => acc + toCents(wd.uber_earned), 0);
  const totalIfoodCents = workDays.reduce((acc, wd) => acc + toCents(wd.ifood_earned), 0);

  const totalEarned = fromCents(totalEarnedCents);
  const totalUber = fromCents(totalUberCents);
  const totalIfood = fromCents(totalIfoodCents);
  const totalDeliveries = workDays.reduce((acc, wd) => acc + (wd.total_deliveries || 0), 0);
  
  const totalDistance = workDays.reduce((acc, wd) => {
    if (wd.odometer_start !== null && wd.odometer_end !== null) {
      return acc + (Number(wd.odometer_end) - Number(wd.odometer_start));
    }
    return acc;
  }, 0);

  const totalMs = sessions.reduce((acc, s) => {
    if (s.start_time && s.end_time) {
      return acc + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime());
    }
    return acc;
  }, 0);

  const totalHours = totalMs / 3600000;

  return {
    totalEarned,
    totalUber,
    totalIfood,
    totalDeliveries,
    totalDistance,
    totalMs,
    totalHours,
    avgPerHour: totalHours > 0 ? fromCents(Math.round(totalEarnedCents / totalHours)) : 0,
    avgPerKm: totalDistance > 0 ? fromCents(Math.round(totalEarnedCents / totalDistance)) : 0,
    avgPerDelivery: totalDeliveries > 0 ? fromCents(Math.round(totalEarnedCents / totalDeliveries)) : 0,
    deliveriesPerHour: totalHours > 0 ? totalDeliveries / totalHours : 0,
  };
};

export const calculateGoalMetrics = (workDays: any[], goal: number | null) => {
  if (goal === null) return null;

  const todayStr = getLocalDateString();
  const todayData = workDays.find(wd => wd.date === todayStr);
  const earningsCents = toCents(todayData?.total_earned);
  const goalCents = toCents(goal);

  const progress = goalCents > 0 ? (earningsCents / goalCents) * 100 : 0;
  const remaining = fromCents(Math.max(0, goalCents - earningsCents));
  const isReached = earningsCents >= goalCents;

  return {
    goal: fromCents(goalCents),
    earnings: fromCents(earningsCents),
    progress,
    remaining,
    isReached
  };
};

export const getChartData = (workDays: any[], sessions: any[]) => {
  const dayMap = new Map();
  
  workDays.forEach(wd => {
    const metrics = calculateMetrics([wd], sessions.filter(s => s.work_day_id === wd.id));
    dayMap.set(wd.date, {
      date: wd.date,
      label: formatDateBR(wd.date),
      displayDate: formatDateBR(wd.date).split('/')[0],
      earned: metrics.totalEarned,
      deliveries: metrics.totalDeliveries,
      hours: metrics.totalHours,
    });
  });

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};
