import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { fetchDashboardData } from '@/lib/dashboard.functions'
import { calculateMetrics, formatCurrency, formatDuration, getDatesForPeriod, getLocalDateString } from '@/lib/dashboard-utils'

export const Route = createFileRoute('/_authenticated/dashboard')({ component: DashboardPage })

const C = { bg:'#111216', green:'#B8E64A', coral:'#F06A4F', purple:'#6750D8', teal:'#168C84' }

function DashboardPage() {
  const today = useMemo(() => getLocalDateString(), [])
  const range = useMemo(() => getDatesForPeriod('Este mês'), [])
  const { data } = useSuspenseQuery({
    queryKey:['dashboard', range.startDate, range.endDate],
    queryFn:() => fetchDashboardData({ data:range }),
    refetchInterval:15000,
  })
  const month = useMemo(() => calculateMetrics(data.workDays, data.sessions), [data])
  const day = data.workDays.find((d:any) => d.date === today)
  const session = data.activeSession
  const active = Boolean(data.hasActiveSession && session && day)
  const elapsed = session?.start_time ? Math.max(0, Date.now()-new Date(session.start_time).getTime()) : 0
  const km = day?.odometer_start != null && day?.odometer_end != null ? Math.max(0,Number(day.odometer_end)-Number(day.odometer_start)) : 0
  const last = data.lastCompletedDay
  const lastKm = last?.odometer_start != null && last?.odometer_end != null ? Math.max(0,Number(last.odometer_end)-Number(last.odometer_start)) : 0
  const goal = Number(day?.daily_goal || data.todayGoal || 0)
  const earned = Number(day?.total_earned || 0)
  const pct = goal > 0 ? Math.round((earned/goal)*100) : 0

  return <main className="fixed inset-0 overflow-hidden text-[#f6f6f3]" style={{background:C.bg}}>
    <div className="mx-auto flex h-full max-w-[480px] flex-col overflow-hidden px-[22px] pb-[18px] pt-5 max-[700px]:pb-3 max-[700px]:pt-[14px]">
      <header className="flex h-7 shrink-0 items-start justify-between text-[11px]">
        <b className="text-[18px] tracking-[.03em]">EM ROTA</b>
      </header>

      <section className="relative mt-2 min-h-0 flex-1 max-[700px]:mt-1">
        {active ? <>
          <Card cls="top-0 z-[1]" color={C.green} dark label="GANHOS" value={formatCurrency(earned)}
            detail={goal>0 ? `${pct}% da meta de ${formatCurrency(goal)}` : `iFood ${formatCurrency(Number(day!.ifood_earned)||0)} · Uber ${formatCurrency(Number(day!.uber_earned)||0)}`} />
          <Card cls="top-[22%] z-[2]" color={C.coral} label="ENTREGAS" value={String(day!.total_deliveries||0)}
            detail={`${day!.ifood_deliveries||0} iFood + ${day!.uber_deliveries||0} Uber`} />
          <Card cls="top-[44%] z-[3]" color={C.purple} label="TEMPO" value={formatDuration(elapsed)}
            detail={`jornada iniciada às ${new Date(session!.start_time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})}`} />
          <Card cls="top-[66%] z-[4]" color={C.teal} label="KM RODADOS HOJE" value={`${km.toLocaleString('pt-BR',{maximumFractionDigits:1})} km`}
            detail={`odômetro inicial ${Number(day!.odometer_start||0).toLocaleString('pt-BR')} km`}
            split={<><span>Distância da jornada</span><span>{day!.odometer_end != null ? `Atual ${Number(day!.odometer_end).toLocaleString('pt-BR')} km` : 'Aguardando atualização'}</span></>} />
        </> : <>
          <CardLink cls="top-0 z-[1]" color={C.green} to="/jornadas" dark label="ÚLTIMA JORNADA"
            value={last ? formatCurrency(Number(last.total_earned)||0) : 'R$ 0,00'}
            detail={last ? `${last.total_deliveries||0} entregas · ${lastKm.toLocaleString('pt-BR',{maximumFractionDigits:1})} km` : 'Nenhuma jornada concluída'} />
          <CardLink cls="top-[22%] z-[2]" color={C.coral} to="/historico" label="ARQUIVO"
            value="Histórico" detail="Meses anteriores · jornadas concluídas" />
          <CardLink cls="top-[44%] z-[3]" color={C.purple} to="/historico" search={{ periodo: "mes" }} label="ESTE MÊS"
            value={formatCurrency(month.totalEarned)}
            detail={`iFood ${formatCurrency(month.totalIfood)} · Uber ${formatCurrency(month.totalUber)} · ${month.totalDeliveries} entregas`} />
          <CardLink cls="top-[66%] z-[4]" color={C.teal} to="/desempenho" label="MÉTRICAS DO MÊS"
            value={month.avgPerKm > 0 ? `${formatCurrency(month.avgPerKm)}/km` : 'Métricas'}
            detail={`${month.totalDistance.toLocaleString('pt-BR',{maximumFractionDigits:1})} km · ${month.totalDeliveries} entregas · ${formatDuration(month.totalMs)}`} />
        </>}
      </section>
    </div>
  </main>
}

function Card({cls,color,label,value,detail,split,dark=false}:{cls:string;color:string;label:string;value:string;detail:string;split?:React.ReactNode;dark?:boolean}) {
  const fg=dark?'#14160e':'#fff'
  return <article className={`absolute left-0 right-0 h-[31%] min-h-[150px] max-h-[190px] overflow-hidden rounded-[28px] border border-white/10 px-[22px] py-[21px] shadow-[0_-11px_27px_#0005] max-[700px]:min-h-[138px] max-[700px]:px-5 max-[700px]:py-[18px] ${cls}`} style={{background:color,color:fg}}>
    <small className="text-[9px] font-black tracking-[.14em]">{label}</small>
    <strong className="mt-[10px] block text-[clamp(36px,11vw,44px)] font-black leading-none tracking-[-.045em]">{value}</strong>
    <p className="mt-[6px] text-[11px] font-semibold opacity-[.67]">{detail}</p>
    {split&&<div className="mt-[14px] flex justify-between gap-[10px] border-t border-white/30 pt-[11px] text-[10px] font-bold">{split}</div>}
  </article>
}

function CardLink({cls,color,to,label,value,detail,dark=false,search}:{cls:string;color:string;to:'/historico'|'/jornadas'|'/desempenho';label:string;value:string;detail:string;dark?:boolean;search?:any}) {
  const fg=dark?'#14160e':'#fff'
  return <Link to={to} search={search} className={`absolute left-0 right-0 block h-[31%] min-h-[150px] max-h-[190px] overflow-hidden rounded-[28px] border border-white/10 px-[22px] py-[21px] shadow-[0_-11px_27px_#0005] max-[700px]:min-h-[138px] max-[700px]:px-5 max-[700px]:py-[18px] ${cls}`} style={{background:color,color:fg}}>
    <small className="text-[9px] font-black tracking-[.14em]">{label}</small>
    <strong className="mt-[10px] block text-[clamp(36px,11vw,44px)] font-black leading-none tracking-[-.045em]">{value}</strong>
    <p className="mt-[6px] text-[11px] font-semibold opacity-[.67]">{detail}</p>
  </Link>
}
