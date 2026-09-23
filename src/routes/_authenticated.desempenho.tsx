import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Clock, Gauge, Package, TrendingUp, Zap,
  Trophy, Wallet
} from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchDashboardData } from '@/lib/dashboard.functions'
import {
  calculateMetrics,
  formatCurrency,
  formatDuration,
  getLocalDateString
} from '@/lib/dashboard-utils'
import { toCents, fromCents } from '@/lib/money'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_authenticated/desempenho')({
  component: PerformancePage,
})

const PERIODS = [
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'all', label: 'Geral' },
] as const

function periodStart(period: string): string {
  const localToday = getLocalDateString()
  const [year, month, day] = localToday.split('-').map(Number)
  const now = new Date(year, month - 1, day)
  const d = new Date(now)
  if (period === '7d') d.setDate(now.getDate() - 6)
  else if (period === '30d') d.setDate(now.getDate() - 29)
  else return '2020-01-01'
  return d.toISOString().split('T')[0] as string
}

function PerformancePage() {
  const [period, setPeriod] = useState<string>('30d')

  const { data } = useSuspenseQuery({
    queryKey: ['dashboard', 'performance-all'],
    queryFn: () => fetchDashboardData({
      data: {
        startDate: '2020-01-01',
        endDate: getLocalDateString()
      }
    })
  })

  const startDate = periodStart(period)

  const filtered = useMemo(() => {
    const workDays = data.workDays.filter(wd => wd.date >= startDate)
    const ids = new Set(workDays.map(wd => wd.id))
    const sessions = data.sessions.filter(s => ids.has(s.work_day_id))
    return { workDays, sessions }
  }, [data, startDate])

  const metrics = useMemo(
    () => calculateMetrics(filtered.workDays, filtered.sessions),
    [filtered]
  )
  const avgDays = filtered.workDays.length || 1

  const platform = useMemo(() => {
    const ifood = metrics.totalIfood
    const uber = metrics.totalUber
    // Soma em centavos para nunca perder centavos na comparação
    const totalCents = toCents(ifood) + toCents(uber)
    const total = fromCents(totalCents)
    return {
      ifood, uber, total,
      ifoodPct: totalCents > 0 ? (toCents(ifood) / totalCents) * 100 : 0,
      uberPct: totalCents > 0 ? (toCents(uber) / totalCents) * 100 : 0,
    }
  }, [metrics])

  const records = useMemo(() => {
    let maxEarned = 0
    let maxDeliveries = 0
    let bestPerHour = 0

    data.workDays.forEach(wd => {
      const earnedCents = toCents(wd.total_earned)
      maxEarned = Math.max(maxEarned, earnedCents)
      maxDeliveries = Math.max(maxDeliveries, wd.total_deliveries || 0)
      const daySessions = data.sessions.filter(s => s.work_day_id === wd.id)
      const dayMetrics = calculateMetrics([wd], daySessions)
      if (dayMetrics.totalHours >= 0.5) {
        bestPerHour = Math.max(bestPerHour, dayMetrics.avgPerHour)
      }
    })

    return {
      maxEarned: fromCents(maxEarned),
      maxDeliveries,
      bestPerHour,
    }
  }, [data])

  return (
    <div className="min-h-screen bg-[#111216] text-white">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl px-5 pb-16 pt-6 md:px-10 md:pt-10 space-y-6"
      >
        {/* Cabeçalho */}
        <div className="flex items-center gap-4">
          <div className="hidden" aria-hidden="true" />
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-3xl font-black tracking-[-0.04em] md:text-4xl">Desempenho</h1>
            <p className="text-white/40 text-[10px] font-bold tracking-[0.18em] uppercase">
              Insights avançados da sua rentabilidade.
            </p>
          </div>
        </div>

        {/* Filtros de período */}
        <div className="grid grid-cols-3 gap-2">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "min-w-0 rounded-full border px-2 py-2 text-[10px] font-semibold uppercase tracking-tight transition-all active:scale-95 sm:text-xs sm:tracking-wide",
                period === p.id
                  ? "bg-[#B8E64A] border-[#B8E64A] text-black"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Grid de Métricas 2x3 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard icon={Wallet} label="Ganhos médios/dia" value={formatCurrency(fromCents(Math.round(toCents(metrics.totalEarned) / avgDays)))} />
          <MetricCard icon={TrendingUp} label="Ganhos por hora" value={metrics.avgPerHour > 0 ? `${formatCurrency(metrics.avgPerHour)}/h` : '—'} />
          <MetricCard icon={Gauge} label="Ganhos por km" value={metrics.avgPerKm > 0 ? `${formatCurrency(metrics.avgPerKm)}/km` : '—'} />
          <MetricCard icon={Zap} label="Entregas por hora" value={metrics.deliveriesPerHour > 0 ? metrics.deliveriesPerHour.toFixed(1) : '—'} />
          <MetricCard icon={Package} label="Média entregas/dia" value={filtered.workDays.length > 0 ? (metrics.totalDeliveries / avgDays).toFixed(1) : '—'} />
          <MetricCard icon={Clock} label="Tempo médio" value={metrics.totalMs > 0 ? formatDuration(metrics.totalMs / avgDays) : '—'} />
        </div>

        {/* Comparativo de Plataformas */}
        <div className="rounded-[28px] border border-white/10 bg-[#1A1C20] p-5 md:p-6 text-white space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">
              Plataformas
            </h3>
            <span className="text-[10px] font-semibold text-white/55">
              Total: {formatCurrency(platform.total)}
            </span>
          </div>

          <div className="space-y-2">
            <PlatformCompareRow
              label="iFood"
              dotColor="bg-white" rowClassName="bg-[#EA1D2C]"
              pct={platform.ifoodPct}
              total={platform.ifood}
              avgPerDelivery={metrics.totalDeliveries > 0 ? fromCents(Math.round(toCents(platform.ifood) / metrics.totalDeliveries)) : 0}
            />
            <PlatformCompareRow
              label="Uber"
              dotColor="bg-white" rowClassName="bg-black"
              pct={platform.uberPct}
              total={platform.uber}
              avgPerDelivery={metrics.totalDeliveries > 0 ? fromCents(Math.round(toCents(platform.uber) / metrics.totalDeliveries)) : 0}
            />
          </div>
        </div>

        {/* Recordes Pessoais */}
        <div className="rounded-[28px] border border-white/10 bg-[#24262B] p-5 md:p-6 text-white space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-white" />
            <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em]">
              Recordes Pessoais
            </h3>
          </div>
          <div className="space-y-2">
            <RecordRow
              emoji="🏆"
              label="Maior ganho em um dia"
              value={records.maxEarned > 0 ? formatCurrency(records.maxEarned) : '—'}
            />
            <RecordRow
              emoji="⚡"
              label="Melhor média R$/hora"
              value={records.bestPerHour > 0 ? `${formatCurrency(records.bestPerHour)}/h` : '—'}
            />
            <RecordRow
              emoji="📦"
              label="Mais entregas em uma jornada"
              value={records.maxDeliveries > 0 ? records.maxDeliveries.toString() : '—'}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#1A1C20] p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#B8E64A]/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-[#B8E64A]" />
        </div>
        <span className="text-[9px] font-bold text-white/45 uppercase tracking-widest leading-tight">
          {label}
        </span>
      </div>
      <div className="text-lg font-black tracking-tight text-white truncate">{value}</div>
    </div>
  )
}

function PlatformCompareRow({ label, dotColor, rowClassName, pct, total, avgPerDelivery }: {
  label: string
  dotColor: string
  rowClassName: string
  pct: number
  total: number
  avgPerDelivery: number
}) {
  return (
    <div className={cn("flex items-center justify-between rounded-[18px] border border-white/10 px-4 py-3", rowClassName)}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor)} />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white">{label}</div>
          <div className="text-[10px] text-white/55">
            {pct.toFixed(0)}% do total · {avgPerDelivery > 0 ? `${formatCurrency(avgPerDelivery)}/entrega` : '—'}
          </div>
        </div>
      </div>
      <span className="text-sm font-bold text-white shrink-0">{formatCurrency(total)}</span>
    </div>
  )
}

function RecordRow({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[18px] border border-white/15 bg-black/10 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base leading-none">{emoji}</span>
        <span className="text-xs font-medium text-white/65">{label}</span>
      </div>
      <span className="text-sm font-bold text-white shrink-0">{value}</span>
    </div>
  )
}
