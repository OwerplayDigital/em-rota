import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock3, Map } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/jornadas')({ component: JornadasPage })

type WorkDay = {
  id: string
  date: string
  status: 'in_progress' | 'completed'
  odometer_start: number | null
  odometer_end: number | null
  ifood_earned: number | null
  uber_earned: number | null
  total_earned: number | null
  total_deliveries: number | null
}

type Journey = {
  id: string
  work_day_id: string
  start_time: string
  end_time: string | null
  status: 'active' | 'completed'
  work_days?: WorkDay | null
}

function formatDate(value?: string) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function JornadasPage() {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [loading, setLoading] = useState(true)

  const loadJourneys = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('id, work_day_id, start_time, end_time, status, work_days(id, date, status, odometer_start, odometer_end, ifood_earned, uber_earned, total_earned, total_deliveries)')
      .eq('status', 'completed')
      .order('start_time', { ascending: false })
      .limit(50)

    if (error) {
      console.error(error)
      toast.error('Não foi possível carregar as jornadas.')
    } else {
      setJourneys((data ?? []) as unknown as Journey[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadJourneys() }, [loadJourneys])

  return (
    <div className="min-h-screen bg-[#111216] p-5 pb-16 text-white md:p-8">
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Jornadas</h1>

      <div className="mt-8 grid gap-3">
        {loading ? (
          <div className="py-10 text-center text-sm text-white/40">Carregando jornadas...</div>
        ) : journeys.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-[#1A1C20] px-6 py-12 text-center">
            <Map className="mx-auto mb-3 h-7 w-7 text-white/30" />
            <p className="font-semibold">Nenhuma jornada finalizada</p>
            <p className="mt-1 text-xs text-white/40">As jornadas encerradas pelo bot aparecerão aqui.</p>
          </div>
        ) : journeys.map((journey) => {
          const day = journey.work_days
          const km = day?.odometer_start != null && day?.odometer_end != null
            ? Math.max(0, Number(day.odometer_end) - Number(day.odometer_start))
            : null
          return (
            <div key={journey.id} className="rounded-[26px] border border-white/10 bg-[#1A1C20] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <CalendarDays className="h-4 w-4 text-white/45" />
                    {formatDate(day?.date)}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-white/45">
                    <Clock3 className="h-4 w-4" />
                    {formatTime(journey.start_time)} → {formatTime(journey.end_time)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-[#B8E64A]">
                    R$ {Number(day?.total_earned ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white/40">
                    {Number(day?.total_deliveries ?? 0)} entregas
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white/55">
                {km != null && <span className="rounded-full bg-white/7 px-3 py-1.5">{km.toLocaleString('pt-BR')} km</span>}
                <span className="rounded-full bg-white/7 px-3 py-1.5">iFood R$ {Number(day?.ifood_earned ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span className="rounded-full bg-white/7 px-3 py-1.5">Uber R$ {Number(day?.uber_earned ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
