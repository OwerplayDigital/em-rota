import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchDashboardData } from '@/lib/dashboard.functions'
import { calculateMetrics, formatCurrency, formatDuration, getDatesForPeriod, getLocalDateString } from '@/lib/dashboard-utils'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

const COLORS = {
  bg: '#111315',
  green: '#B8E64A',
  coral: '#F06A4F',
  purple: '#6750D8',
  teal: '#168C84',
  cream: '#F2EEE6',
}

function DashboardPage() {
  const today = useMemo(() => getLocalDateString(), [])
  const monthRange = useMemo(() => getDatesForPeriod('Este mês'), [])
  const { data } = useSuspenseQuery({
    queryKey: ['dashboard', monthRange.startDate, monthRange.endDate],
    queryFn: () => fetchDashboardData({ data: monthRange }),
    refetchInterval: 15000,
  })

  const monthMetrics = useMemo(() => calculateMetrics(data.workDays, data.sessions), [data])
  const todayDay = data.workDays.find((day: any) => day.date === today)
  const activeSession = data.activeSession
  const isActive = Boolean(data.hasActiveSession && activeSession && todayDay)

  const activeElapsed = activeSession?.start_time
    ? Math.max(0, Date.now() - new Date(activeSession.start_time).getTime())
    : 0
  const currentKm = todayDay?.odometer_start != null && todayDay?.odometer_end != null
    ? Math.max(0, Number(todayDay.odometer_end) - Number(todayDay.odometer_start))
    : 0

  const lastDay = data.lastCompletedDay
  const lastKm = lastDay?.odometer_start != null && lastDay?.odometer_end != null
    ? Math.max(0, Number(lastDay.odometer_end) - Number(lastDay.odometer_start))
    : 0

  return (
    <main className="h-[100dvh] overflow-hidden px-4 pb-4 pt-3 md:px-8" style={{ background: COLORS.bg }}>
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <header className="mb-2 flex items-center justify-between pl-12 md:pl-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">Em Rota</p>
            <h1 className="text-xl font-semibold tracking-tight text-white">{isActive ? 'Jornada em andamento' : 'Seu dia'}</h1>
          </div>
          {isActive && <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">Ao vivo</span>}
        </header>

        {isActive ? (
          <div className="relative min-h-0 flex-1">
            <StackCard top="0%" color={COLORS.green} label="Ganhos" value={formatCurrency(Number(todayDay?.total_earned) || 0)}
              detail={<>iFood {formatCurrency(Number(todayDay?.ifood_earned) || 0)} · {todayDay?.ifood_deliveries ?? 0} entregas<br/>Uber {formatCurrency(Number(todayDay?.uber_earned) || 0)} · {todayDay?.uber_deliveries ?? 0} entregas</>} />
            <StackCard top="25%" color={COLORS.coral} label="Entregas" value={String(todayDay?.total_deliveries ?? 0)}
              detail={<>iFood {todayDay?.ifood_deliveries ?? 0} · Uber {todayDay?.uber_deliveries ?? 0}</>} />
            <StackCard top="50%" color={COLORS.purple} label="Tempo" value={formatDuration(activeElapsed)}
              detail={<>Início {new Date(activeSession.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</>} />
            <StackCard top="75%" color={COLORS.teal} label="KM rodados hoje" value={currentKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km'}
              detail={<>Odômetro inicial {Number(todayDay?.odometer_start || 0).toLocaleString('pt-BR')}</>} />
          </div>
        ) : (
          <div className="relative min-h-0 flex-1">
            <StackLink top="0%" color={COLORS.cream} to="/historico" label="Última jornada"
              value={lastDay ? formatCurrency(Number(lastDay.total_earned) || 0) : 'Sem registros'}
              detail={lastDay ? <>{lastDay.total_deliveries ?? 0} entregas · {lastKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</> : <>Sua próxima jornada aparecerá aqui</>} dark />
            <StackLink top="25%" color={COLORS.coral} to="/historico" label="Histórico" value="Ver jornadas"
              detail={<>Ganhos, entregas e desempenho por período</>} />
            <StackLink top="50%" color={COLORS.green} to="/historico" label="Este mês" value={formatCurrency(monthMetrics.totalEarned)}
              detail={<>iFood {formatCurrency(monthMetrics.totalIfood)} · Uber {formatCurrency(monthMetrics.totalUber)}<br/>{monthMetrics.totalDeliveries} entregas · {monthMetrics.totalHours.toFixed(1)}h</>} dark />
            <StackLink top="75%" color={COLORS.teal} to="/historico" label="KM rodados no mês"
              value={monthMetrics.totalDistance.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km'}
              detail={<>Abrir detalhes do período</>} />
          </div>
        )}

        <Link
          to="/jornadas"
          className="mt-3 flex h-14 shrink-0 items-center justify-center rounded-[22px] bg-white text-sm font-bold uppercase tracking-[0.12em] text-black transition active:scale-[0.99]"
        >
          {isActive ? 'Gerenciar jornada' : 'Iniciar jornada'}
        </Link>
      </div>
    </main>
  )
}

function StackCard({ top, color, label, value, detail }: { top: string; color: string; label: string; value: string; detail: React.ReactNode }) {
  return (
    <section className="absolute left-0 h-[43%] w-full rounded-[28px] p-5 shadow-[0_-8px_24px_rgba(0,0,0,.16)]" style={{ top, background: color }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/55">{label}</p>
      <p className="mt-1 text-[32px] font-black leading-none tracking-[-0.04em] text-black">{value}</p>
      <div className="mt-3 text-[11px] font-semibold leading-5 text-black/65">{detail}</div>
    </section>
  )
}

function StackLink({ top, color, to, label, value, detail, dark = false }: { top: string; color: string; to: '/historico'; label: string; value: string; detail: React.ReactNode; dark?: boolean }) {
  const text = dark ? 'text-black' : 'text-white'
  const muted = dark ? 'text-black/55' : 'text-white/65'
  return (
    <Link to={to} className="absolute left-0 block h-[43%] w-full rounded-[28px] p-5 shadow-[0_-8px_24px_rgba(0,0,0,.16)] transition active:scale-[0.995]" style={{ top, background: color }}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${muted}`}>{label}</p>
      <p className={`mt-1 text-[30px] font-black leading-none tracking-[-0.04em] ${text}`}>{value}</p>
      <div className={`mt-3 text-[11px] font-semibold leading-5 ${muted}`}>{detail}</div>
    </Link>
  )
}
