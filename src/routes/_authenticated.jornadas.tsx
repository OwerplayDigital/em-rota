import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  Map,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fromCents, toCents } from '@/lib/money'
import { getLocalDateString } from '@/lib/dashboard-utils'

export const Route = createFileRoute('/_authenticated/jornadas')({ component: JornadasPage })

type WorkDay = {
  id: string
  date: string
  status: 'in_progress' | 'completed'
  odometer_start: number | null
  odometer_end: number | null
  uber_earned: number | null
  ifood_earned: number | null
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

function localDate() {
  return getLocalDateString()
}

function parseNumberBR(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return Number.NaN

  let normalized = trimmed.replace(/\s/g, '')
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.')
  }

  return Number(normalized)
}

function formatDate(value?: string) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

function formatTime(value?: string | null) {
  if (!value) return 'Em andamento'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value))
}

function JornadasPage() {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [todayDay, setTodayDay] = useState<WorkDay | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [ending, setEnding] = useState(false)
  const [closing, setClosing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [odometer, setOdometer] = useState('')
  const [closeOdometer, setCloseOdometer] = useState('')
  const [uberEarned, setUberEarned] = useState('')
  const [ifoodEarned, setIfoodEarned] = useState('')
  const [deliveries, setDeliveries] = useState('')

  const loadJourneys = useCallback(async () => {
    setLoading(true)

    const [sessionsResult, dayResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, work_day_id, start_time, end_time, status, work_days(id, date, status, odometer_start, odometer_end, uber_earned, ifood_earned, total_earned, total_deliveries)')
        .order('start_time', { ascending: false })
        .limit(50),
      supabase
        .from('work_days')
        .select('id, date, status, odometer_start, odometer_end, uber_earned, ifood_earned, total_earned, total_deliveries')
        .eq('date', localDate())
        .maybeSingle(),
    ])

    if (sessionsResult.error || dayResult.error) {
      console.error(sessionsResult.error ?? dayResult.error)
      toast.error('Não foi possível carregar as jornadas.')
    } else {
      setJourneys((sessionsResult.data ?? []) as unknown as Journey[])
      setTodayDay((dayResult.data ?? null) as WorkDay | null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadJourneys()
  }, [loadJourneys])

  const activeJourney = useMemo(
    () => journeys.find((journey) => journey.status === 'active'),
    [journeys]
  )

  const todayOdometerStart = todayDay?.odometer_start ?? null

  const startJourney = async () => {
    if (activeJourney) {
      toast.error('Já existe uma jornada em andamento.')
      return
    }

    setCreating(true)
    try {
      const today = localDate()
      const { data: existingDay, error: dayLookupError } = await supabase
        .from('work_days')
        .select('id, date, status, odometer_start')
        .eq('date', today)
        .maybeSingle()

      if (dayLookupError) throw dayLookupError
      if (existingDay?.status === 'completed') {
        toast.error('O dia de hoje está fechado. Reabra o dia antes de iniciar outra jornada.')
        return
      }

      let workDayId = existingDay?.id

      if (!existingDay || existingDay.odometer_start === null) {
        const odo = parseNumberBR(odometer)
        if (!Number.isFinite(odo) || odo < 0) {
          toast.error('Informe um odômetro inicial válido.')
          return
        }

        if (existingDay) {
          const { error } = await supabase
            .from('work_days')
            .update({ odometer_start: odo })
            .eq('id', existingDay.id)
          if (error) throw error
        } else {
          const { data: newDay, error } = await supabase
            .from('work_days')
            .insert({ date: today, status: 'in_progress', odometer_start: odo })
            .select('id')
            .single()
          if (error) throw error
          workDayId = newDay.id
        }
      }

      if (!workDayId) throw new Error('Dia de trabalho não encontrado')

      const { data: activeSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (activeSession) {
        toast.error('Já existe uma jornada em andamento.')
        await loadJourneys()
        return
      }

      const { error: sessionError } = await supabase
        .from('sessions')
        .insert({ work_day_id: workDayId, status: 'active' })
      if (sessionError) throw sessionError

      toast.success('Jornada iniciada com sucesso.')
      setOdometer('')
      setShowForm(false)
      await loadJourneys()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível iniciar a jornada.')
    } finally {
      setCreating(false)
    }
  }

  const endJourney = async () => {
    if (!activeJourney) {
      toast.error('Não existe uma jornada em andamento.')
      return
    }

    setEnding(true)
    try {
      const { data: endedSession, error } = await supabase
        .from('sessions')
        .update({ end_time: new Date().toISOString(), status: 'completed' })
        .eq('id', activeJourney.id)
        .eq('status', 'active')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!endedSession) {
        toast.error('A jornada já foi alterada em outro lugar. Atualizando os dados.')
        await loadJourneys()
        return
      }

      toast.success('Jornada encerrada com sucesso.')
      await loadJourneys()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível encerrar a jornada.')
    } finally {
      setEnding(false)
    }
  }

  const closeDay = async () => {
    setClosing(true)
    try {
      const { data: activeSession, error: activeError } = await supabase
        .from('sessions')
        .select('id')
        .eq('status', 'active')
        .maybeSingle()

      if (activeError) throw activeError
      if (activeSession) {
        toast.error('Encerre a jornada em andamento antes de fechar o dia.')
        return
      }

      const { data: day, error: dayError } = await supabase
        .from('work_days')
        .select('id, status, odometer_start')
        .eq('date', localDate())
        .maybeSingle()

      if (dayError) throw dayError
      if (!day) {
        toast.error('Nenhum dia de trabalho encontrado para hoje.')
        return
      }
      if (day.status === 'completed') {
        toast.error('O dia de hoje já está fechado.')
        return
      }

      const finalOdometer = parseNumberBR(closeOdometer)
      const startOdometer = Number(day.odometer_start)
      const uber = parseNumberBR(uberEarned)
      const ifood = parseNumberBR(ifoodEarned)
      const deliveryCount = parseNumberBR(deliveries)

      if (!Number.isFinite(finalOdometer) || finalOdometer < startOdometer) {
        toast.error(`O odômetro final deve ser igual ou maior que ${startOdometer.toLocaleString('pt-BR')} km.`)
        return
      }
      if (!Number.isFinite(uber) || uber < 0) {
        toast.error('Informe um valor válido para os ganhos da Uber, ou 0.')
        return
      }
      if (!Number.isFinite(ifood) || ifood < 0) {
        toast.error('Informe um valor válido para os ganhos do iFood, ou 0.')
        return
      }
      if (!Number.isFinite(deliveryCount) || deliveryCount < 0 || !Number.isInteger(deliveryCount)) {
        toast.error('Informe uma quantidade inteira válida de entregas.')
        return
      }

      const uberValue = fromCents(toCents(uber))
      const ifoodValue = fromCents(toCents(ifood))
      const totalEarned = fromCents(toCents(uber) + toCents(ifood))

      const { data: closedDay, error } = await supabase
        .from('work_days')
        .update({
          odometer_end: finalOdometer,
          uber_earned: uberValue,
          ifood_earned: ifoodValue,
          total_earned: totalEarned,
          total_deliveries: deliveryCount,
          status: 'completed',
          notes: null,
        })
        .eq('id', day.id)
        .eq('status', 'in_progress')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!closedDay) {
        toast.error('O dia já foi alterado em outro lugar. Atualizando os dados.')
        await loadJourneys()
        return
      }

      toast.success('Dia fechado com sucesso.')
      setShowCloseForm(false)
      setCloseOdometer('')
      setUberEarned('')
      setIfoodEarned('')
      setDeliveries('')
      await loadJourneys()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível fechar o dia.')
    } finally {
      setClosing(false)
    }
  }

  const deleteJourney = async (journey: Journey) => {
    if (journey.status === 'active') {
      toast.error('Encerre a jornada antes de excluí-la.')
      return
    }

    setDeletingId(journey.id)
    try {
      const { data: deletedSession, error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', journey.id)
        .eq('status', 'completed')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!deletedSession) {
        toast.error('A jornada já foi alterada em outro lugar. Atualizando os dados.')
        setConfirmDeleteId(null)
        await loadJourneys()
        return
      }

      toast.success('Jornada excluída com sucesso.')
      setConfirmDeleteId(null)
      await loadJourneys()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível excluir a jornada.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#111216] p-5 pb-16 text-white md:p-8 space-y-6">
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-[-0.04em] text-white">Jornadas</h1>

        </div>
        <Button
          onClick={() => setShowForm((value) => !value)}
          disabled={!!activeJourney || todayDay?.status === 'completed'}
          className="rounded-[18px] gap-2 self-start bg-[#B8E64A] text-black hover:bg-[#B8E64A]/90"
        >
          <Plus className="h-4 w-4" />
          Nova jornada
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-[28px] border-white/10 bg-[#1A1C20] text-white shadow-[0_12px_30px_rgba(0,0,0,.2)]">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Play className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Iniciar nova jornada</h2>
                <p className="text-xs text-white/50 mt-0.5">O odômetro é registrado uma vez por dia, como no bot.</p>
              </div>
            </div>

            <div className="max-w-sm space-y-3">
              {todayOdometerStart === null ? (
                <>
                  <label htmlFor="odometer" className="text-xs font-semibold text-white/60">Odômetro inicial do dia (km)</label>
                  <input
                    id="odometer"
                    inputMode="decimal"
                    value={odometer}
                    onChange={(event) => setOdometer(event.target.value)}
                    placeholder="Ex.: 12540"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  Odômetro inicial do dia já registrado: <strong>{Number(todayOdometerStart).toLocaleString('pt-BR')} km</strong>.
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button onClick={startJourney} disabled={creating || !!activeJourney} className="rounded-xl gap-2">
                  {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Iniciar jornada
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancelar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeJourney && (
        <Card className="rounded-[28px] border-[#B8E64A]/30 bg-[#B8E64A] text-black shadow-[0_12px_30px_rgba(0,0,0,.2)]">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                <div className="relative h-11 w-11 shrink-0 rounded-xl bg-white flex items-center justify-center border border-emerald-100">
                  <Map className="h-5 w-5 text-emerald-700" />
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-tight text-emerald-900">Jornada em andamento</div>
                  <div className="text-sm text-emerald-700 mt-1">Iniciada às {formatTime(activeJourney.start_time)} · {formatDate(activeJourney.work_days?.date)}</div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={endJourney}
                disabled={ending}
                className="w-full sm:w-auto shrink-0 rounded-xl gap-2 border-emerald-300 text-emerald-800"
              >
                {ending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                Encerrar jornada
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {todayDay && (
        <Card className={`rounded-2xl shadow-sm ${todayDay.status === 'completed' ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
          <CardContent className="p-5 md:p-6">
            {todayDay.status === 'completed' ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-emerald-900">Dia fechado</h2>
                  <p className="text-xs text-emerald-700 mt-0.5">Os dados finais de hoje já foram registrados.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Flag className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white">Fechar dia</h2>
                      <p className="text-xs text-white/50 mt-0.5">Registre os dados finais somente quando terminar o trabalho de hoje.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!!activeJourney}
                    onClick={() => setShowCloseForm((value) => !value)}
                    className="w-full sm:w-auto rounded-xl gap-2"
                  >
                    <Flag className="h-4 w-4" />
                    Fechar dia
                  </Button>
                </div>

                {activeJourney && (
                  <p className="mt-3 text-xs text-amber-700">Encerre a jornada em andamento antes de fechar o dia.</p>
                )}

                {showCloseForm && !activeJourney && (
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                      <label className="space-y-1.5 text-xs font-semibold text-white/60">
                        Odômetro final (km)
                        <input
                          inputMode="decimal"
                          value={closeOdometer}
                          onChange={(event) => setCloseOdometer(event.target.value)}
                          placeholder={`Mínimo: ${Number(todayDay.odometer_start ?? 0).toLocaleString('pt-BR')}`}
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-normal text-white outline-none focus:border-[#B8E64A] focus:ring-2 focus:ring-[#B8E64A]/10"
                        />
                      </label>

                      <label className="space-y-1.5 text-xs font-semibold text-white/60">
                        Ganhos Uber (R$)
                        <input
                          inputMode="decimal"
                          value={uberEarned}
                          onChange={(event) => setUberEarned(event.target.value)}
                          placeholder="Ex.: 85,50 ou 0"
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-normal text-white outline-none focus:border-[#B8E64A] focus:ring-2 focus:ring-[#B8E64A]/10"
                        />
                      </label>

                      <label className="space-y-1.5 text-xs font-semibold text-white/60">
                        Ganhos iFood (R$)
                        <input
                          inputMode="decimal"
                          value={ifoodEarned}
                          onChange={(event) => setIfoodEarned(event.target.value)}
                          placeholder="Ex.: 120,00 ou 0"
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-normal text-white outline-none focus:border-[#B8E64A] focus:ring-2 focus:ring-[#B8E64A]/10"
                        />
                      </label>

                      <label className="space-y-1.5 text-xs font-semibold text-white/60">
                        Entregas
                        <input
                          inputMode="numeric"
                          value={deliveries}
                          onChange={(event) => setDeliveries(event.target.value)}
                          placeholder="Ex.: 12"
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-normal text-white outline-none focus:border-[#B8E64A] focus:ring-2 focus:ring-[#B8E64A]/10"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <Button onClick={closeDay} disabled={closing} className="w-full sm:w-auto rounded-xl gap-2">
                        {closing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Confirmar fechamento
                      </Button>
                      <Button variant="outline" onClick={() => setShowCloseForm(false)} disabled={closing} className="w-full sm:w-auto rounded-xl">
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}


    </div>
  )
}
