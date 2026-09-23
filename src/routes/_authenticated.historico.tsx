import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  Package, Bike, Clock, Zap, ChevronDown,
  Gauge, ArrowRight, CircleDollarSign, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchDashboardData } from '@/lib/dashboard.functions'
import {
  formatDateBR,
  formatTimeBR,
  formatDuration,
  formatCurrency,
  calculateMetrics,
  getLocalDateString
} from '@/lib/dashboard-utils'
import { toCents, fromCents } from '@/lib/money'

export const Route = createFileRoute('/_authenticated/historico')({
  component: HistoryPage,
})

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'semana', label: 'Esta Semana' },
  { id: 'mes', label: 'Este Mês' },
  { id: 'ano', label: 'Este Ano' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

function localTodayParts() {
  const today = getLocalDateString()
  const [year, month, day] = today.split('-').map(Number)
  return { today, date: new Date(year, month - 1, day) }
}

function todayStrBR() {
  return getLocalDateString()
}

function startOfWeekBR() {
  const { date: now } = localTodayParts()
  const day = (now.getDay() + 6) % 7
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function startOfMonthBR() {
  return `${getLocalDateString().slice(0, 7)}-01`
}

function dateRangeForFilter(filter: FilterId) {
  const endDate = todayStrBR()
  switch (filter) {
    case 'semana':
      return { startDate: startOfWeekBR(), endDate }
    case 'mes':
      return { startDate: startOfMonthBR(), endDate }
    case 'ano':
      return { startDate: `${getLocalDateString().slice(0, 4)}-01-01`, endDate }
    default:
      return { startDate: '2020-01-01', endDate }
  }
}

function HistoryPage() {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const initialFilter = (search?.get('periodo') as FilterId) || 'todos'
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>(FILTERS.some(f => f.id === initialFilter) ? initialFilter : 'todos')
  const [showEmpty, setShowEmpty] = useState(false)

  // O filtro selecionado define o intervalo de datas buscado no Supabase
  const { startDate, endDate } = useMemo(() => dateRangeForFilter(filter), [filter])

  const { data } = useSuspenseQuery({
    queryKey: ['dashboard', 'history', filter, startDate, endDate],
    queryFn: () => fetchDashboardData({ data: { startDate, endDate } }),
  })

  const historyItems = useMemo(() => {
    const range = dateRangeForFilter(filter)

    // Filtra por intervalo de datas e mantém a ordem (mais recente → mais antigo)
    return data.workDays
      .filter(wd => wd.date >= range.startDate && wd.date <= range.endDate)
      .map(wd => {
        const daySessions = data.sessions.filter(s => s.work_day_id === wd.id)
        const metrics = calculateMetrics([wd], daySessions)
        return { ...wd, metrics, daySessions }
      })
  }, [data, filter])

  const periodSummary = useMemo(() => {
    const totalEarned = historyItems.reduce((sum, i) => sum + Number(i.total_earned || 0), 0)
    const ifoodEarned = historyItems.reduce((sum, i) => sum + Number(i.ifood_earned || 0), 0)
    const uberEarned = historyItems.reduce((sum, i) => sum + Number(i.uber_earned || 0), 0)
    const ifoodDeliveries = historyItems.reduce((sum, i) => sum + Number(i.ifood_deliveries || 0), 0)
    const uberDeliveries = historyItems.reduce((sum, i) => sum + Number(i.uber_deliveries || 0), 0)
    return { totalEarned, ifoodEarned, uberEarned, ifoodDeliveries, uberDeliveries, totalDeliveries: ifoodDeliveries + uberDeliveries }
  }, [historyItems])

    const activeDays = historyItems.filter(i => (i.total_earned || 0) > 0 || (i.total_deliveries || 0) > 0)
  const emptyDays = historyItems.filter(i => (i.total_earned || 0) === 0 && (i.total_deliveries || 0) === 0)
  const visibleDays = showEmpty ? [...activeDays, ...emptyDays].sort((a, b) => b.date.localeCompare(a.date)) : activeDays

  return (
    <div className="min-h-screen bg-[#111216] text-white">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 md:px-10 md:pt-10 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-4">
          <div className="w-14 shrink-0 md:hidden" aria-hidden="true" />
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-3xl font-black tracking-[-0.04em]">Histórico</h1>
            <p className="text-white/45 text-[10px] font-bold tracking-[0.18em] uppercase">
              Suas jornadas passadas.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all active:scale-95",
                filter === f.id
                  ? "bg-[#B8E64A] border-[#B8E64A] text-black"
                  : "bg-white/5 border-white/10 text-white/55 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#6750D8] p-6 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Resumo do período</div>
          <div className="mt-2 text-4xl font-black tracking-[-0.04em]">{formatCurrency(periodSummary.totalEarned)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-[10px] font-black uppercase tracking-wider text-white/55">iFood</div><div className="font-bold">{formatCurrency(periodSummary.ifoodEarned)}</div><div className="text-xs text-white/60">{periodSummary.ifoodDeliveries} entregas</div></div>
            <div><div className="text-[10px] font-black uppercase tracking-wider text-white/55">Uber</div><div className="font-bold">{formatCurrency(periodSummary.uberEarned)}</div><div className="text-xs text-white/60">{periodSummary.uberDeliveries} entregas</div></div>
          </div>
          <div className="mt-4 border-t border-white/20 pt-3 text-xs font-semibold text-white/65">Total: {periodSummary.totalDeliveries} entregas</div>
        </div>

        {/* Feed de Cards */}
        <div className="space-y-3">
          {visibleDays.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#1A1C20] p-12 text-center space-y-2">
              <p className="text-white/55 text-xs uppercase tracking-[0.2em] font-bold">
                Nenhuma jornada encontrada para o período selecionado
              </p>
              <p className="text-white/55/60 text-[11px]">
                {filter === 'todos'
                  ? 'Novas jornadas aparecerão aqui após serem finalizadas no bot.'
                  : 'Tente selecionar “Todos” para ver o histórico completo.'}
              </p>
            </div>
          )}

          {visibleDays.map(item => (
            <HistoryCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            />
          ))}

          {emptyDays.length > 0 && (
            <button
              onClick={() => setShowEmpty(!showEmpty)}
              className="w-full rounded-xl border border-dashed border-white/10 bg-muted/20 py-3 text-[11px] font-semibold uppercase tracking-widest text-white/55 hover:bg-white/10 transition-colors"
            >
              {showEmpty
                ? 'Ocultar dias sem corridas'
                : `Mostrar ${emptyDays.length} ${emptyDays.length === 1 ? 'dia zerado' : 'dias zerados'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryCard({ item, expanded, onToggle }: { item: any; expanded: boolean; onToggle: () => void }) {
  const distance = (item.odometer_end !== null && item.odometer_start !== null)
    ? Number(item.odometer_end) - Number(item.odometer_start)
    : null

  const uber = Number(item.uber_earned || 0)
  const ifood = Number(item.ifood_earned || 0)
  const extra = Math.max(0, fromCents(toCents(item.total_earned) - toCents(uber) - toCents(ifood)))
  const deliveries = item.total_deliveries || 0
  const avgPerDelivery = deliveries > 0 ? fromCents(Math.round(toCents(item.total_earned) / deliveries)) : 0

  return (
    <div
      onClick={onToggle}
      className={cn(
        "w-full cursor-pointer rounded-[24px] border border-white/10 bg-[#1A1C20] text-left text-white transition-all duration-200 overflow-hidden",
        expanded
          ? "border-[#B8E64A]/40 shadow-[0_12px_30px_rgba(0,0,0,.25)]"
          : "border-white/10 hover:border-white/20"
      )}
    >
      {/* Card fechado */}
      <div className="p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white">{formatDateBR(item.date)}</span>
            <ChevronDown className={cn(
              "w-4 h-4 shrink-0 text-white/55 transition-transform duration-300",
              expanded && "rotate-180 text-[#B8E64A]"
            )} />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#B8E64A] shrink-0">
            {formatCurrency(item.total_earned || 0)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Badge icon={Package} value={deliveries.toString()} />
          <Badge icon={Bike} value={distance !== null ? `${distance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '—'} />
          <Badge icon={Clock} value={item.metrics.totalMs > 0 ? formatDuration(item.metrics.totalMs) : '—'} />
          <Badge icon={Zap} value={item.metrics.avgPerHour > 0 ? `${formatCurrency(item.metrics.avgPerHour)}/h` : '—'} highlight />
        </div>
      </div>

      {/* Expansão */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-5 py-5 space-y-6">
              {/* Plataformas */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-white/55 uppercase tracking-[0.2em]">
                  Por Plataforma
                </h3>
                <div className="space-y-2">
                  <PlatformRow label="iFood" value={ifood} color="bg-red-500" />
                  <PlatformRow label="Uber" value={uber} color="bg-cyan-500" />
                  {extra > 0 && <PlatformRow label="Extra / Particular" value={extra} color="bg-primary" />}
                </div>
              </div>

              {/* Odômetro */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-white/55 uppercase tracking-[0.2em]">
                  Odômetro
                </h3>
                <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
                  <Gauge className="w-4 h-4 text-white/55 shrink-0" />
                  <span className="text-sm font-semibold text-white">
                    {item.odometer_start !== null
                      ? Number(item.odometer_start).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                      : '—'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-white/55 shrink-0" />
                  <span className="text-sm font-semibold text-white">
                    {item.odometer_end !== null
                      ? Number(item.odometer_end).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                      : '—'}
                  </span>
                  <span className="text-[10px] text-white/55 ml-auto">km</span>
                </div>
              </div>

              {/* Média por entrega */}
              <div className="flex items-center justify-between rounded-xl bg-[#B8E64A]/10 border border-[#B8E64A]/20 p-4">
                <div className="flex items-center gap-3">
                  <CircleDollarSign className="w-4 h-4 text-[#B8E64A]" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/55">
                    Média por Entrega
                  </span>
                </div>
                <span className="text-sm font-bold text-[#B8E64A]">
                  {avgPerDelivery > 0 ? formatCurrency(avgPerDelivery) : '—'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Badge({ icon: Icon, value, highlight = false }: { icon: any; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-full px-2.5 py-1",
      highlight ? "bg-[#B8E64A]/10" : "bg-white/10"
    )}>
      <Icon className={cn("w-3.5 h-3.5", highlight ? "text-[#B8E64A]" : "text-white/55")} />
      <span className={cn(
        "text-[11px] font-semibold",
        highlight ? "text-[#B8E64A]" : "text-white/80"
      )}>{value}</span>
    </div>
  )
}

function PlatformRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1A1C20] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className={cn("w-2 h-2 rounded-full", color)} />
        <span className="text-xs font-semibold text-white/80">{label}</span>
      </div>
      <span className="text-sm font-bold text-white">{formatCurrency(value)}</span>
    </div>
  )
}
