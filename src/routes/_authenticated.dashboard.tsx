import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Clock,
  Package,
  MapPin,
  DollarSign,
  Calendar,
  Gauge,
  Fuel,
  Timer,
  Banknote,
  Smartphone,
  Activity,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchDashboardData } from '@/lib/dashboard.functions'
import {
  getDatesForPeriod,
  calculateMetrics,
  getChartData,
  formatCurrency,
  formatDuration,
  getLocalDateString,
} from '@/lib/dashboard-utils'
import { toCents, fromCents } from '@/lib/money'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

const periods = ['Hoje', '7 dias', 'Este mês', 'Este ano']

// Paleta fixa Light Mode (SaaS financeiro)
const C = {
  bg: '#f8fafc',
  title: '#0f172a',
  sub: '#475569',
  border: '#e2e8f0',
  accent: '#2563eb',
}

function DashboardPage() {
  const [activePeriod, setActivePeriod] = useState('Hoje')
  const { startDate, endDate } = useMemo(() => getDatesForPeriod(activePeriod), [activePeriod])

  const { data } = useSuspenseQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboardData({ data: { startDate, endDate } }),
  })

  const metrics = useMemo(() => calculateMetrics(data.workDays, data.sessions), [data])

  // Extra = Total − Uber − iFood, calculado em centavos inteiros
  const extraEarned = Math.max(0, fromCents(toCents(metrics.totalEarned) - toCents(metrics.totalUber) - toCents(metrics.totalIfood)))

  // Status da jornada (baseado em dados de hoje)
  const todayStr = useMemo(() => getLocalDateString(), [])
  const todayWorkDay = data.workDays.find((wd: any) => wd.date === todayStr)
  const hasActiveSession = data.sessions.some((s: any) => s.status === 'active') || todayWorkDay?.status === 'in_progress'

  // Fatias por plataforma (aproximação: entregas proporcionais aos ganhos)
  const platforms = [
    {
      name: 'iFood',
      color: '#ea1d2c',
      earned: metrics.totalIfood,
    },
    {
      name: 'Uber',
      color: '#0f172a',
      earned: metrics.totalUber,
    },
    {
      name: 'Extra / Particular',
      color: '#7c3aed',
      earned: extraEarned,
    },
  ].map((p) => ({
    ...p,
    share: metrics.totalEarned > 0 ? (p.earned / metrics.totalEarned) * 100 : 0,
    deliveries: Math.round(metrics.totalDeliveries * (metrics.totalEarned > 0 ? p.earned / metrics.totalEarned : 0)),
    avg: p.earned > 0 && metrics.totalDeliveries > 0 ? fromCents(Math.round(toCents(p.earned) / Math.max(1, Math.round(metrics.totalDeliveries * (p.earned / metrics.totalEarned))))) : 0,
  }))

  const chartData = useMemo(() => getChartData(data.workDays, data.sessions), [data])
  const hasData = data.workDays.length > 0

  const odometerInfo = useMemo(() => {
    const withOdo = data.workDays.filter((wd: any) => wd.odometer_start !== null && wd.odometer_end !== null)
    if (withOdo.length === 0) return null
    const minStart = Math.min(...withOdo.map((wd: any) => Number(wd.odometer_start)))
    const maxEnd = Math.max(...withOdo.map((wd: any) => Number(wd.odometer_end)))
    return { minStart, maxEnd }
  }, [data.workDays])

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 md:space-y-8" style={{ backgroundColor: C.bg }}>
      {/* Cabeçalho + seletor de período (somente leitura) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="mt-2 pl-14 md:mt-0 md:pl-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: C.title }}>
            Dashboard
          </h1>
          <p className="text-xs md:text-sm mt-1" style={{ color: C.sub }}>
            Acompanhamento de desempenho · lançamentos via Telegram
          </p>
        </div>
        <div
          className="flex self-start rounded-xl p-1 border"
          style={{ backgroundColor: '#ffffff', borderColor: C.border }}
        >
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                activePeriod === period ? 'text-white shadow-sm' : 'hover:bg-slate-100'
              )}
              style={activePeriod === period ? { backgroundColor: C.accent } : { color: C.sub }}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* HERO CARD — Faturamento do dia */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: C.border }}>
          <CardContent className="px-6 py-6 md:px-8 md:py-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: C.sub }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: C.sub }}>
                  Faturamento Total {activePeriod === 'Hoje' ? 'do Dia' : `· ${activePeriod}`}
                </span>
              </div>
              <div
                className="text-4xl md:text-5xl font-bold tracking-tight"
                style={{ color: C.title }}
              >
                {formatCurrency(metrics.totalEarned)}
              </div>
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold border',
                  hasActiveSession ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', hasActiveSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400')} />
                {hasActiveSession ? 'Jornada Ativa' : 'Nenhuma jornada em andamento'}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* GRID DE MÉTRICAS OPERACIONAIS */}
      <div>
        <SectionTitle title="Métricas Operacionais" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <MetricCard
            title="Tempo On-line"
            value={formatDuration(metrics.totalMs)}
            icon={Timer}
          />
          <MetricCard
            title="Distância Total"
            value={`${metrics.totalDistance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`}
            icon={MapPin}
            subtext={odometerInfo ? `Odômetro ${odometerInfo.minStart.toLocaleString('pt-BR')} → ${odometerInfo.maxEnd.toLocaleString('pt-BR')}` : undefined}
          />
          <MetricCard title="Total de Entregas" value={metrics.totalDeliveries.toString()} icon={Package} />
          <MetricCard title="Média por Hora" value={metrics.avgPerHour > 0 ? formatCurrency(metrics.avgPerHour) : '—'} icon={Clock} />
          <MetricCard title="Média por KM" value={metrics.avgPerKm > 0 ? formatCurrency(metrics.avgPerKm) : '—'} icon={Fuel} />
          <MetricCard title="Média por Entrega" value={metrics.avgPerDelivery > 0 ? formatCurrency(metrics.avgPerDelivery) : '—'} icon={Banknote} />
        </div>
      </div>

      {/* DETALHAMENTO POR PLATAFORMA */}
      <div>
        <SectionTitle title="Ganhos por Plataforma" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {platforms.map((p) => (
            <Card key={p.name} className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: C.border }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.sub }}>
                  {p.name}
                </CardTitle>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 space-y-3">
                <div className="text-2xl md:text-3xl font-bold" style={{ color: C.title }}>
                  {formatCurrency(p.earned)}
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.share)}%`, backgroundColor: p.color }} />
                </div>
                <div className="flex justify-between text-xs" style={{ color: C.sub }}>
                  <span>{p.deliveries} entregas ({p.share.toFixed(0)}%)</span>
                  <span className="font-semibold" style={{ color: C.title }}>
                    {p.deliveries > 0 ? `${formatCurrency(p.avg)}/entrega` : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <ChartCard title="Evolução dos Ganhos" subtitle={activePeriod}>
          {hasData ? (
            <div className="h-[260px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.accent} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="label" stroke={C.sub} fontSize={10} axisLine={false} tickLine={false} dy={10} minTickGap={20} />
                  <YAxis stroke={C.sub} fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderRadius: '0.75rem', fontSize: '11px' }}
                    labelStyle={{ color: C.sub, fontWeight: 'bold', marginBottom: 4 }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Ganhos']}
                  />
                  <Area type="monotone" dataKey="earned" stroke={C.accent} strokeWidth={2} fill="url(#colorEarned)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={TrendingUp} text="Sem registros neste período" />
          )}
        </ChartCard>

        <ChartCard title="Entregas por Dia" subtitle={activePeriod}>
          {hasData ? (
            <div className="h-[260px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="label" stroke={C.sub} fontSize={10} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke={C.sub} fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: `1px solid ${C.border}`, borderRadius: '0.75rem', fontSize: '11px' }}
                    labelStyle={{ color: C.sub, fontWeight: 'bold', marginBottom: 4 }}
                    cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                    formatter={(value: any) => [value, 'Entregas']}
                  />
                  <Bar dataKey="deliveries" fill={C.accent} radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Calendar} text="Aguardando registros" />
          )}
        </ChartCard>
      </div>

      {/* EFICIÊNCIA */}
      <div>
        <SectionTitle title="Eficiência" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <SmallMetric label="Entregas / Hora" value={metrics.deliveriesPerHour > 0 ? metrics.deliveriesPerHour.toFixed(1) : '—'} icon={Gauge} />
          <SmallMetric label="Horas Trabalhadas" value={`${metrics.totalHours.toFixed(1)}h`} icon={Activity} />
          <SmallMetric label="Ganho Uber" value={formatCurrency(metrics.totalUber)} icon={Smartphone} />
          <SmallMetric label="Ganho iFood" value={formatCurrency(metrics.totalIfood)} icon={Smartphone} />
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.sub }}>
        {title}
      </h2>
      <div className="h-px flex-1" style={{ backgroundColor: C.border }} />
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, subtext }: { title: string; value: string; icon: any; subtext?: string | undefined }) {
  return (
    <Card className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: C.border }}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 pt-4 px-4 md:pt-5 md:px-5">
        <CardTitle className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.sub }}>
          {title}
        </CardTitle>
        <Icon className="w-4 h-4" style={{ color: C.sub }} />
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 md:px-5 md:pb-5">
        <div className="text-lg md:text-2xl font-bold" style={{ color: C.title }}>
          {value}
        </div>
        {subtext && (
          <div className="text-[9px] md:text-[10px] mt-1 leading-tight" style={{ color: C.sub }}>
            {subtext}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: C.border }}>
      <CardHeader className="p-5 md:p-6 pb-2">
        <CardTitle className="text-base md:text-lg font-bold" style={{ color: C.title }}>
          {title}
        </CardTitle>
        {subtitle && <p className="text-[11px]" style={{ color: C.sub }}>{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-2 pb-4 md:px-4">{children}</CardContent>
    </Card>
  )
}

function SmallMetric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div
      className="p-4 md:p-5 rounded-2xl border shadow-sm flex items-start justify-between gap-2"
      style={{ backgroundColor: '#ffffff', borderColor: C.border }}
    >
      <div className="space-y-1">
        <div className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.sub }}>
          {label}
        </div>
        <div className="text-lg md:text-xl font-bold" style={{ color: C.title }}>
          {value}
        </div>
      </div>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.sub }} />
    </div>
  )
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div
      className="h-[260px] w-full flex items-center justify-center border border-dashed rounded-2xl"
      style={{ borderColor: C.border, backgroundColor: '#fafbfc' }}
    >
      <div className="text-center space-y-3 p-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border"
          style={{ backgroundColor: '#ffffff', borderColor: C.border }}
        >
          <Icon className="w-5 h-5" style={{ color: C.sub }} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.sub }}>
          {text}
        </p>
      </div>
    </div>
  )
}
