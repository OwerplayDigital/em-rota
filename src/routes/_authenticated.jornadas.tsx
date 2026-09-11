import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, Map, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated/jornadas')({ component: JornadasPage })

type WorkDay = {
  id: string
  date: string
  status: 'in_progress' | 'completed'
  odometer_start: number | null
  odometer_end?: number | null
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
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [ending, setEnding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [odometer, setOdometer] = useState('')

  const loadJourneys = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('id, work_day_id, start_time, end_time, status, work_days(id, date, status, odometer_start, odometer_end)')
      .order('start_time', { ascending: false })
      .limit(50)

    if (error) toast.error('Não foi possível carregar as jornadas.')
    else setJourneys((data ?? []) as unknown as Journey[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadJourneys()
  }, [loadJourneys])

  const activeJourney = useMemo(
    () => journeys.find((journey) => journey.status === 'active'),
    [journeys]
  )

  const todayJourney = useMemo(
    () => journeys.find((journey) => journey.work_days?.date === localDate()),
    [journeys]
  )

  const todayOdometerStart = todayJourney?.work_days?.odometer_start ?? null

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
        const odo = Number(odometer.replace(',', '.'))
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
      const { error } = await supabase
        .from('sessions')
        .update({ end_time: new Date().toISOString(), status: 'completed' })
        .eq('id', activeJourney.id)
        .eq('status', 'active')

      if (error) throw error

      toast.success('Jornada encerrada com sucesso.')
      await loadJourneys()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível encerrar a jornada.')
    } finally {
      setEnding(false)
    }
  }

  const deleteJourney = async (journey: Journey) => {
    if (journey.status === 'active') {
      toast.error('Encerre a jornada antes de excluí-la.')
      return
    }

    setDeletingId(journey.id)
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', journey.id)
        .eq('status', 'completed')

      if (error) throw error

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
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      <div className="mt-2 pl-14 md:mt-0 md:pl-0 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Jornadas</h1>
          <p className="mt-1 text-sm text-slate-500">Crie e acompanhe suas jornadas diretamente pelo Em Rota.</p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)} disabled={!!activeJourney} className="rounded-xl gap-2 self-start">
          <Plus className="h-4 w-4" />
          Nova jornada
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Play className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Iniciar nova jornada</h2>
                <p className="text-xs text-slate-500 mt-0.5">O odômetro é registrado uma vez por dia, como no bot.</p>
              </div>
            </div>

            <div className="max-w-sm space-y-3">
              {todayOdometerStart === null ? (
                <>
                  <label htmlFor="odometer" className="text-xs font-semibold text-slate-600">Odômetro inicial do dia (km)</label>
                  <input
                    id="odometer"
                    inputMode="decimal"
                    value={odometer}
                    onChange={(event) => setOdometer(event.target.value)}
                    placeholder="Ex.: 12540"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  />
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 shadow-sm">
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

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Últimas jornadas</h2>
          <button onClick={loadJourneys} className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>

        {loading ? (
          <Card className="rounded-2xl border-slate-200"><CardContent className="p-8 text-center text-sm text-slate-500">Carregando jornadas...</CardContent></Card>
        ) : journeys.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-300 bg-white shadow-none">
            <CardContent className="py-12 text-center">
              <Map className="h-8 w-8 mx-auto text-slate-300 mb-3" />
              <div className="text-sm font-semibold text-slate-700">Nenhuma jornada registrada</div>
              <p className="text-xs text-slate-400 mt-1">Sua primeira jornada criada pelo site aparecerá aqui.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {journeys.map((journey) => (
              <Card key={journey.id} className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${journey.status === 'active' ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                      <Map className={`h-4 w-4 ${journey.status === 'active' ? 'text-emerald-600' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900">Jornada</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${journey.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {journey.status === 'active' ? 'Em andamento' : 'Finalizada'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(journey.work_days?.date)}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatTime(journey.start_time)} → {formatTime(journey.end_time)}</span>
                      </div>
                    </div>
                    {journey.status === 'completed' && (
                      <button
                        type="button"
                        aria-label="Excluir jornada"
                        onClick={() => setConfirmDeleteId(confirmDeleteId === journey.id ? null : journey.id)}
                        className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {confirmDeleteId === journey.id && (
                    <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3">
                      <p className="text-xs text-red-800">Excluir esta jornada? Essa ação não pode ser desfeita.</p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="destructive" disabled={deletingId === journey.id} onClick={() => deleteJourney(journey)} className="rounded-lg gap-1.5">
                          {deletingId === journey.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Excluir
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)} className="rounded-lg">Cancelar</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
