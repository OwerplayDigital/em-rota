import { supabaseAdmin } from './client.server';
import { toCents, fromCents } from '@/lib/money';

export const handleTelegramUpdate = async (body: any) => {
  const botToken = (process.env['TELEGRAM_BOT_TOKEN'] ?? '') as string;
  const allowedUserId = (process.env['TELEGRAM_ALLOWED_USER_ID'] ?? '') as string;

  if (!botToken || !allowedUserId) return;

  const send = async (text: string, markup?: any) => {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: allowedUserId, text, parse_mode: 'HTML', reply_markup: markup }),
    });
    return res.json();
  };

  const deleteMessage = async (messageId: number) => {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: allowedUserId, message_id: messageId }),
      });
    } catch (e) {
      console.error('Failed to delete message:', messageId, e);
    }
  };

  const msg = body.message;
  if (!msg || String(msg.from?.id) !== allowedUserId) return;

  const textInput = (msg.text || '') as string;
  const getUserToday = () => {
    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  };
  const today = getUserToday();

  // Helpers
  const formatDateBR = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDateTimeBR = (date: Date | string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date)).replace(', ', ' às ');
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h${minutes}min`;
  };

  const formatCurrency = (val: number | null) => val !== null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Ainda não informado';
  const formatNumberBR = (val: number | null) => val !== null ? val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : 'Ainda não informado';

  const formatTimeBR = (date: string | Date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getActiveWorkDay = async (): Promise<any> => {
    const { data: day } = await (supabaseAdmin.from('work_days').select('*').eq('date', today as any).maybeSingle() as any);
    
    // If day exists but has no goal, try to fetch the most recent goal
    if (day && day.daily_goal === null) {
      const { data: lastGoalRecord } = await (supabaseAdmin
        .from('work_days')
        .select('daily_goal')
        .not('daily_goal', 'is', null)
        .lt('date', today as any)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      
      if (lastGoalRecord?.daily_goal) {
        day.daily_goal = lastGoalRecord.daily_goal;
      }
    }
    
    return day;
  };

  const getActiveSession = async (): Promise<any> => {
    const activeRes = await (supabaseAdmin.from('sessions').select('*').eq('status', 'active' as any).maybeSingle() as any);
    return activeRes.data;
  };

  const getSummary = async (day: any) => {
    const { data: sessions } = await (supabaseAdmin.from('sessions').select('*').eq('work_day_id', day.id).eq('status', 'completed' as any) as any);
    
    let totalMs = 0;
    (sessions as any[])?.forEach(s => {
      if (s.start_time && s.end_time) {
        totalMs += new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
      }
    });

    const distance = (day.odometer_end !== null && day.odometer_start !== null) ? (Number(day.odometer_end) - Number(day.odometer_start)) : null;
    const hours = totalMs / 3600000;
    
    const earnedCents = toCents(day.total_earned);
    const perHour = (hours > 0 && day.total_earned !== null) ? fromCents(Math.round(earnedCents / hours)) : null;
    const perKm = (distance && distance > 0 && day.total_earned !== null) ? fromCents(Math.round(earnedCents / distance)) : null;
    const perDelivery = (day.total_deliveries && day.total_deliveries > 0 && day.total_earned !== null) ? fromCents(Math.round(earnedCents / day.total_deliveries)) : null;

    const goalCents = toCents(day.daily_goal);
    const goalStr = day.daily_goal !== null ? 
      `\n<b>META DO DIA</b>\n` +
      `${formatCurrency(day.total_earned)} / ${formatCurrency(day.daily_goal)}\n` +
      `${(goalCents > 0 ? (earnedCents / goalCents) * 100 : 0).toFixed(1)}%${earnedCents >= goalCents ? ' - META ATINGIDA' : ''}\n` +
      `${earnedCents < goalCents ? `Faltam: ${formatCurrency(fromCents(goalCents - earnedCents))}` : 'Meta Atingida'}\n` : '';

    return `<b>RESUMO DE ${formatDateBR(day.date)}</b>\n\n` +
      `<b>Ganhos:</b>\n${formatCurrency(day.total_earned)} (iFood: ${formatCurrency(day.ifood_earned)} | Uber: ${formatCurrency(day.uber_earned)})\n\n` +
      `<b>Entregas:</b>\n${day.total_deliveries ?? 'Ainda não informado'}\n\n` +
      `<b>Distância:</b>\n${distance !== null ? `${formatNumberBR(distance)} km` : 'Ainda não informado'}\n\n` +
      `<b>Tempo na rua:</b>\n${formatDuration(totalMs)}\n\n` +
      `<b>Odômetro:</b>\n${formatNumberBR(day.odometer_start) ?? '?'}${day.odometer_end !== null ? ` → ${formatNumberBR(day.odometer_end)}` : ''} km\n\n` +
      `<b>MÉDIAS</b>\n\n` +
      `${formatCurrency(perHour)}/h\n` +
      `${formatCurrency(perKm)}/km\n` +
      `${formatCurrency(perDelivery)}/entrega\n` +
      goalStr;
  };

  const mainMenu = {
    keyboard: [
      [{ text: 'INICIAR JORNADA' }, { text: 'ENCERRAR JORNADA' }],
      [{ text: 'RESUMO' }, { text: 'FECHAR DIA' }],
      [{ text: 'CORRIGIR DIA' }, { text: 'LIMPAR CHAT' }]
    ],
    resize_keyboard: true
  };

  const activeJourneyMenu = {
    keyboard: [
      [{ text: 'LANÇAR IFOOD' }, { text: 'LANÇAR UBER' }],
      [{ text: 'ATUALIZAR KM' }],
      [{ text: 'RESUMO' }, { text: 'ENCERRAR JORNADA' }],
      [{ text: 'CANCELAR JORNADA' }, { text: 'LIMPAR CHAT' }]
    ],
    resize_keyboard: true
  };

  const cancelMenu = {
    keyboard: [[{ text: 'CANCELAR' }]],
    resize_keyboard: true
  };

  const clearChatMenu = {
    keyboard: [[{ text: 'SIM, LIMPAR' }, { text: 'CANCELAR' }]],
    resize_keyboard: true
  };

  const correctionMenu = {
    keyboard: [
      [{ text: 'HORÁRIO DE INÍCIO' }, { text: 'HORÁRIO DE ENCERRAMENTO' }],
      [{ text: 'ODÔMETRO INICIAL' }, { text: 'ODÔMETRO FINAL' }],
      [{ text: 'GANHOS IFOOD' }, { text: 'GANHOS UBER' }],
      [{ text: 'ENTREGAS' }, { text: 'ADICIONAR JORNADA' }],
      [{ text: 'EXCLUIR JORNADA' }, { text: 'REABRIR DIA' }],
      [{ text: 'VOLTAR' }]
    ],
    resize_keyboard: true
  };

  // REMOVED platformMenu as flow is now sequential


  // Logic
  const activeSession = await getActiveSession();
  let activeDay = await getActiveWorkDay();

  // Command handlers
  if (textInput === '/start' || textInput === 'MENU' || textInput === 'MENU PRINCIPAL') {
    let statusMsg = activeSession ? '🏃 Jornada em andamento.' : '⏸️ Nenhuma jornada ativa.';
    if (activeDay?.status === 'completed') statusMsg = '🏁 Dia fechado.';
    
    await send(`<b>EM ROTA</b>\n\n${statusMsg}`, mainMenu);
    return;
  }

  if (textInput === 'CANCELAR' || textInput === 'VOLTAR') {
    // Reset correction state if any
    if (activeDay?.notes?.includes('CORRECT:') || activeDay?.notes?.includes('AWAITING:') || activeDay?.notes?.includes('ADDSESSION:') || activeDay?.notes?.includes('DELETE_SESSION:')) {
      await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
    }
    await send('Operação cancelada.', mainMenu);
    return;
  }

  if (textInput === 'LANÇAR IFOOD' || textInput === 'LANÇAR UBER') {
    if (!activeSession || !activeDay) {
      await send('Inicie uma jornada antes de lançar ganhos.', mainMenu);
      return;
    }
    const platform = textInput === 'LANÇAR IFOOD' ? 'IFOOD' : 'UBER';
    const { error } = await (supabaseAdmin.from('work_days').update({ notes: `LIVE:EARNED:${platform}` }).eq('id', activeDay.id) as any);
    if (error) {
      console.error('Failed to prepare live earning:', error);
      await send('Não foi possível preparar o lançamento. Tente novamente.', activeJourneyMenu);
      return;
    }
    await send(`Quanto deseja acrescentar ao ${platform === 'IFOOD' ? 'iFood' : 'Uber'}?\nExemplo: 18,50`, cancelMenu);
    return;
  }

  if (textInput === 'ATUALIZAR KM') {
    if (!activeSession || !activeDay) {
      await send('Inicie uma jornada antes de atualizar o odômetro.', mainMenu);
      return;
    }
    const { error } = await (supabaseAdmin.from('work_days').update({ notes: 'LIVE:ODO' }).eq('id', activeDay.id) as any);
    if (error) {
      console.error('Failed to prepare live odometer:', error);
      await send('Não foi possível preparar a atualização. Tente novamente.', activeJourneyMenu);
      return;
    }
    await send(`Qual é o odômetro atual?\nInicial: <b>${formatNumberBR(activeDay.odometer_start)} km</b>`, cancelMenu);
    return;
  }

  if (textInput === 'RESUMO') {
    if (!activeDay) {
      await send('Nenhum dado para hoje.', mainMenu);
    } else {
      const summary = await getSummary(activeDay);
      await send(summary, activeDay.status === 'completed' ? { keyboard: [[{ text: 'CORRIGIR DIA' }, { text: 'EXCLUIR JORNADA' }], [{ text: 'LIMPAR CHAT' }], [{ text: 'MENU' }]], resize_keyboard: true } : (activeSession ? activeJourneyMenu : mainMenu));
    }
    return;
  }

  if (textInput === 'LIMPAR CHAT') {
    await send('<b>Limpar o chat?</b>\n\nIsso apagará somente as mensagens desta conversa do Telegram. Nenhum registro do Em Rota será apagado.', clearChatMenu);
    return;
  }

  if (textInput === 'SIM, LIMPAR') {
    const sent = await send('Limpando mensagens...', { remove_keyboard: true });
    const lastMsgId = sent?.result?.message_id;

    if (lastMsgId) {
      // Telegram allows deleting messages up to 48h old.
      // We try to delete the last 100 messages.
      for (let i = 0; i < 100; i++) {
        await deleteMessage(lastMsgId - i);
      }
    }

    await send('<b>EM ROTA</b>\n\nHistórico visual limpo. Todos os dados permanecem salvos no sistema.', mainMenu);
    return;
  }

  if (textInput === 'INICIAR JORNADA') {
    if (activeDay?.status === 'completed') {
      await send('⚠️ O dia já foi fechado.\n\nPara continuar registrando, use:\n<b>CORRIGIR DIA → REABRIR DIA</b>', {
        keyboard: [[{ text: 'CORRIGIR DIA' }, { text: 'RESUMO' }], [{ text: 'MENU' }]],
        resize_keyboard: true
      });
      return;
    }
    if (activeSession) {
      const startTime = formatDateTimeBR(activeSession.start_time);
      await send(`Você já tem uma jornada em andamento.\n\nInício: ${startTime}\nOdômetro: ${formatNumberBR(activeDay?.odometer_start) ?? 'Não informado'}`, {
        ...activeJourneyMenu
      });
      return;
    }
    
    if (!activeDay || activeDay.odometer_start === null) {
      const { data: lastDay } = await (supabaseAdmin.from('work_days').select('odometer_end').not('odometer_end', 'is', null).order('date', { ascending: false }).limit(1).maybeSingle() as any);
      
      if (lastDay?.odometer_end) {
        await send(`Qual é o odômetro inicial?\n\nO último registrado foi: <b>${formatNumberBR(lastDay.odometer_end)} km</b>`, {
          keyboard: [[{ text: `USAR ${formatNumberBR(lastDay.odometer_end)}` }], [{ text: 'OUTRO VALOR' }], [{ text: 'CANCELAR' }]],
          resize_keyboard: true
        });
        if (activeDay) {
          await (supabaseAdmin.from('work_days').update({ notes: `AWAITING:ODO_START_CONFIRM:${lastDay.odometer_end}` }).eq('id', activeDay.id) as any);
        } else {
          // If no day exists yet, we'll handle it in the numeric flow or create it now with a note
          const res = await (supabaseAdmin.from('work_days').insert({ date: today as any, status: 'in_progress' as any, notes: `AWAITING:ODO_START_CONFIRM:${lastDay.odometer_end}` }).select().single() as any);
        }
      } else {
        await send('Qual é o odômetro inicial da bike?', cancelMenu);
      }
      return;
    }

    await (supabaseAdmin.from('sessions').insert({ work_day_id: activeDay.id, status: 'active' as any }) as any);
    await send('Jornada iniciada!', {
      ...activeJourneyMenu
    });
    return;
  }

  if (textInput === 'CANCELAR JORNADA') {
    if (!activeSession) {
      await send('Não existe nenhuma jornada em andamento para cancelar.', mainMenu);
      return;
    }

    await send(
      `<b>CANCELAR JORNADA?</b>\n\n` +
      `Esta ação vai excluir a jornada iniciada em ${formatDateTimeBR(activeSession.start_time)}.\n` +
      `Ela não será contabilizada no tempo trabalhado nem aparecerá no resumo.\n\n` +
      `<b>Deseja realmente cancelar?</b>`,
      {
        keyboard: [[{ text: 'SIM, CANCELAR JORNADA' }, { text: 'NÃO, VOLTAR' }]],
        resize_keyboard: true
      }
    );
    return;
  }

  if (textInput === 'SIM, CANCELAR JORNADA') {
    if (!activeSession) {
      await send('Não existe nenhuma jornada em andamento para cancelar.', mainMenu);
      return;
    }

    const { error } = await (supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', activeSession.id) as any);

    if (error) {
      console.error('Failed to cancel active session:', error);
      await send('Não foi possível cancelar a jornada. Tente novamente.', mainMenu);
      return;
    }

    await send('<b>JORNADA CANCELADA</b>\n\nA jornada foi removida do registro. Nenhum tempo foi contabilizado.', {
      keyboard: [[{ text: 'INICIAR JORNADA' }, { text: 'RESUMO' }], [{ text: 'MENU' }]],
      resize_keyboard: true
    });
    return;
  }

  if (textInput === 'NÃO, VOLTAR') {
    await send('Operação cancelada. A jornada continua em andamento.', {
      keyboard: [[{ text: 'ENCERRAR JORNADA' }, { text: 'CANCELAR JORNADA' }], [{ text: 'RESUMO' }], [{ text: 'MENU' }]],
      resize_keyboard: true
    });
    return;
  }

  if (textInput === 'ENCERRAR JORNADA') {
    if (!activeSession) {
      await send('Não existe nenhuma jornada em andamento.', mainMenu);
      return;
    }

    const endTime = new Date().toISOString();
    const { error: endSessionError } = await (supabaseAdmin
      .from('sessions')
      .update({ end_time: endTime, status: 'completed' as any })
      .eq('id', activeSession.id)
      .eq('status', 'active' as any) as any);
    if (endSessionError) {
      console.error('Failed to end active session:', endSessionError);
      await send('Não foi possível encerrar a jornada. Nenhum registro foi alterado.', mainMenu);
      return;
    }
    
    const day = await getActiveWorkDay();
    if (!day) return;
    const { data: sessions } = await (supabaseAdmin.from('sessions').select('*').eq('work_day_id', day.id).eq('status', 'completed' as any) as any);
    
    const thisSessionMs = new Date(endTime).getTime() - new Date(activeSession.start_time).getTime();
    let totalMs = 0;
    (sessions as any[])?.forEach(s => {
      if (s.start_time && s.end_time) totalMs += new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
    });

    const distance = (day.odometer_end !== null && day.odometer_start !== null) ? (day.odometer_end - day.odometer_start) : null;

    const earnedCents = toCents(day.total_earned);
    const goalCents = toCents(day.daily_goal);
    const goalStr = day.daily_goal !== null ? 
      `\n\n<b>META DO DIA</b>\n` +
      `${formatCurrency(day.total_earned)} / ${formatCurrency(day.daily_goal)}\n` +
      `${(goalCents > 0 ? (earnedCents / goalCents) * 100 : 0).toFixed(1)}% atingido\n` +
      `${earnedCents < goalCents ? `Faltam: ${formatCurrency(fromCents(goalCents - earnedCents))}` : 'Meta Atingida'}` : '';

    await send(`<b>JORNADA ENCERRADA</b>\n\nDuração desta jornada: ${formatDuration(thisSessionMs)}\n\n<b>TOTAL DE ${formatDateBR(day.date)}:</b>\nTempo na rua: ${formatDuration(totalMs)}\nGanhos: ${formatCurrency(day.total_earned)}\nEntregas: ${day.total_deliveries ?? 'Ainda não informado'}${goalStr}`, {
      keyboard: [[{ text: 'INICIAR JORNADA' }, { text: 'FECHAR DIA' }], [{ text: 'EXCLUIR JORNADA' }, { text: 'RESUMO' }], [{ text: 'LIMPAR CHAT' }], [{ text: 'MENU' }]],
      resize_keyboard: true
    });
    return;
  }

  if (textInput === 'FECHAR DIA') {
    if (activeSession) {
      await send('⚠️ Você ainda tem uma jornada em andamento. Encerre a jornada antes de fechar o dia.', {
        keyboard: [[{ text: 'ENCERRAR JORNADA' }, { text: 'MENU' }]],
        resize_keyboard: true
      });
      return;
    }
    if (!activeDay) {
      await send('Nenhum dado para hoje.', mainMenu);
      return;
    }
    if (activeDay.status === 'completed') {
      await send('O dia de hoje já está fechado.', { keyboard: [[{ text: 'CORRIGIR DIA' }, { text: 'RESUMO' }], [{ text: 'MENU' }]], resize_keyboard: true });
      return;
    }
    await (supabaseAdmin.from('work_days').update({ notes: 'AWAITING:CLOSE_ODO' }).eq('id', activeDay.id) as any);
    await send('Odômetro final:', cancelMenu);
    return;
  }

  // Correction Flow
  if (textInput === 'CORRIGIR DIA') {
    if (!activeDay || activeDay.status !== 'completed') {
      await send('⚠️ O dia precisa estar fechado para correções.', mainMenu);
      return;
    }
    await send('Qual informação você deseja corrigir?', correctionMenu);
    return;
  }

  if (textInput === 'GANHOS UBER') {
    await (supabaseAdmin.from('work_days').update({ notes: 'CORRECT:EARNED_VALUE:UBER' }).eq('id', activeDay.id) as any);
    await send('Qual é o valor correto dos ganhos na Uber?', cancelMenu);
    return;
  }

  if (textInput === 'GANHOS IFOOD') {
    await (supabaseAdmin.from('work_days').update({ notes: 'CORRECT:EARNED_VALUE:IFOOD' }).eq('id', activeDay.id) as any);
    await send('Qual é o valor correto dos ganhos no iFood?', cancelMenu);
    return;
  }

  if (textInput === 'ENTREGAS') {
    await (supabaseAdmin.from('work_days').update({ notes: 'CORRECT:DELIVERIES' }).eq('id', activeDay.id) as any);
    await send('Qual é a quantidade correta de entregas?', cancelMenu);
    return;
  }

  if (textInput === 'ODÔMETRO INICIAL') {
    await (supabaseAdmin.from('work_days').update({ notes: 'CORRECT:ODO_START' }).eq('id', activeDay.id) as any);
    await send('Qual é o odômetro inicial correto?', cancelMenu);
    return;
  }

  if (textInput === 'ODÔMETRO FINAL') {
    await (supabaseAdmin.from('work_days').update({ notes: 'CORRECT:ODO_END' }).eq('id', activeDay.id) as any);
    await send('Qual é o odômetro final correto?', cancelMenu);
    return;
  }

  if (textInput === 'EXCLUIR JORNADA') {
    if (!activeDay) {
      await send('Nenhum dia encontrado para excluir uma jornada.', mainMenu);
      return;
    }

    const { data: sessions, error } = await (supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('work_day_id', activeDay.id)
      .eq('status', 'completed' as any)
      .order('start_time', { ascending: true }) as any);

    if (error) {
      console.error('Failed to load sessions for deletion:', error);
      await send('Não foi possível carregar as jornadas. Tente novamente.', mainMenu);
      return;
    }

    if (!sessions || sessions.length === 0) {
      await send('Não há jornadas encerradas para excluir neste dia.', correctionMenu);
      return;
    }

    if (sessions.length === 1) {
      const session = sessions[0];
      const duration = session.start_time && session.end_time ? formatDuration(new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) : '—';
      await (supabaseAdmin.from('work_days').update({ notes: `DELETE_SESSION:${session.id}` }).eq('id', activeDay.id) as any);
      await send(
        `<b>EXCLUIR JORNADA?</b>\n\nInício: ${formatDateTimeBR(session.start_time)}\nFim: ${session.end_time ? formatDateTimeBR(session.end_time) : '—'}\nDuração: ${duration}\n\nEsta jornada será removida e deixará de ser contabilizada.\n\n<b>Deseja realmente excluir?</b>`,
        { keyboard: [[{ text: 'SIM, EXCLUIR JORNADA' }], [{ text: 'NÃO, EXCLUIR' }]], resize_keyboard: true }
      );
      return;
    }

    const sessionButtons = sessions.map((session: any, index: number) => [{ text: `JORNADA ${index + 1} — ${formatTimeBR(session.start_time)}` }]);
    await (supabaseAdmin.from('work_days').update({ notes: 'DELETE_SESSION:SELECT' }).eq('id', activeDay.id) as any);
    await send('Qual jornada você deseja excluir?', { keyboard: [...sessionButtons, [{ text: 'VOLTAR' }]], resize_keyboard: true });
    return;
  }

  if (activeDay?.notes?.startsWith('DELETE_SESSION:') && textInput.startsWith('JORNADA ')) {
    const { data: sessions } = await (supabaseAdmin.from('sessions').select('*').eq('work_day_id', activeDay.id).eq('status', 'completed' as any).order('start_time', { ascending: true }) as any);
    const match = textInput.match(/^JORNADA (\d+)/);
    const index = match?.[1] ? parseInt(match[1], 10) - 1 : -1;
    const session = sessions?.[index];
    if (!session) {
      await send('Selecione uma jornada válida.', correctionMenu);
      return;
    }
    const duration = session.start_time && session.end_time ? formatDuration(new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) : '—';
    await (supabaseAdmin.from('work_days').update({ notes: `DELETE_SESSION:${session.id}` }).eq('id', activeDay.id) as any);
    await send(
      `<b>EXCLUIR JORNADA?</b>\n\nJornada ${index + 1}\nInício: ${formatDateTimeBR(session.start_time)}\nFim: ${session.end_time ? formatDateTimeBR(session.end_time) : '—'}\nDuração: ${duration}\n\nEsta jornada será removida e deixará de ser contabilizada.\n\n<b>Deseja realmente excluir?</b>`,
      { keyboard: [[{ text: 'SIM, EXCLUIR JORNADA' }], [{ text: 'NÃO, EXCLUIR' }]], resize_keyboard: true }
    );
    return;
  }

  if (textInput === 'SIM, EXCLUIR JORNADA') {
    if (!activeDay?.notes?.startsWith('DELETE_SESSION:')) {
      await send('Nenhuma exclusão de jornada está pendente.', mainMenu);
      return;
    }
    const sessionId = activeDay.notes.split(':')[1];
    if (!sessionId || sessionId === 'SELECT') {
      await send('Selecione a jornada que deseja excluir primeiro.', correctionMenu);
      return;
    }
    const { data: session } = await (supabaseAdmin.from('sessions').select('*').eq('id', sessionId).eq('work_day_id', activeDay.id).eq('status', 'completed' as any).maybeSingle() as any);
    if (!session) {
      await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
      await send('A jornada selecionada não foi encontrada. Nenhuma alteração foi feita.', correctionMenu);
      return;
    }
    const { error } = await (supabaseAdmin.from('sessions').delete().eq('id', sessionId).eq('work_day_id', activeDay.id) as any);
    if (error) {
      console.error('Failed to delete completed session:', error);
      await send('Não foi possível excluir a jornada. Nenhum registro foi alterado.', correctionMenu);
      return;
    }
    await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
    const updatedDay = await getActiveWorkDay();
    await send('<b>JORNADA EXCLUÍDA</b>\n\nA jornada foi removida dos registros e não será contabilizada no tempo trabalhado.', { keyboard: [[{ text: 'EXCLUIR JORNADA' }, { text: 'CORRIGIR DIA' }], [{ text: 'RESUMO' }], [{ text: 'MENU' }]], resize_keyboard: true });
    await send(await getSummary(updatedDay));
    return;
  }

  if (textInput === 'NÃO, EXCLUIR') {
    if (activeDay?.notes?.startsWith('DELETE_SESSION:')) {
      await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
    }
    await send('Operação cancelada. A jornada permanece registrada.', correctionMenu);
    return;
  }

  if (textInput === 'HORÁRIO DE INÍCIO' || textInput === 'HORÁRIO DE ENCERRAMENTO') {
    const { data: sessions } = await (supabaseAdmin.from('sessions').select('*').eq('work_day_id', activeDay.id) as any);
    const mode = textInput === 'HORÁRIO DE INÍCIO' ? 'START_TIME' : 'END_TIME';

    if (!sessions || sessions.length === 0) {
      await send('Nenhuma jornada encontrada para este dia.', correctionMenu);
      return;
    }

    if (sessions.length === 1) {
      await (supabaseAdmin.from('work_days').update({ notes: `CORRECT:${mode}:${sessions[0].id}` }).eq('id', activeDay.id) as any);
      await send(`Qual o novo ${textInput.toLowerCase()}?\nExemplo: 09:30`, cancelMenu);
    } else {
      await (supabaseAdmin.from('work_days').update({ notes: `CORRECT:SELECT_SESSION:${mode}` }).eq('id', activeDay.id) as any);
      const sessionButtons = sessions.map((s: any, i: number) => [{ text: `JORNADA ${i + 1} — ${formatTimeBR(s.start_time)}` }]);
      await send('Qual jornada deseja corrigir?', {
        keyboard: [...sessionButtons, [{ text: 'VOLTAR' }]],
        resize_keyboard: true
      });
    }
    return;
  }

  if (textInput === 'ADICIONAR JORNADA') {
    await (supabaseAdmin.from('work_days').update({ notes: 'ADDSESSION:START_TIME' }).eq('id', activeDay.id) as any);
    await send('Qual o horário de início da nova jornada?\nExemplo: 09:20', cancelMenu);
    return;
  }

  if (textInput === 'REABRIR DIA') {
    await send('Reabrir o dia permitirá continuar registrando jornadas.\nDeseja continuar?', {
      keyboard: [[{ text: 'SIM, REABRIR' }, { text: 'CANCELAR' }]],
      resize_keyboard: true
    });
    return;
  }

  if (textInput === 'SIM, REABRIR') {
    const res = await (supabaseAdmin.from('work_days').update({ status: 'in_progress', notes: null }).eq('id', activeDay.id).select().single() as any);
    await send('Dia reaberto.', {
      keyboard: [[{ text: 'INICIAR JORNADA' }, { text: 'FECHAR DIA' }], [{ text: 'MENU' }]],
      resize_keyboard: true
    });
    return;
  }

  // Input Handling (Numeric/Prices/Times)
  const isTimeInput = /^\d{1,2}:\d{2}$/.test(textInput);
  const rawVal = textInput.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
  const num = parseFloat(rawVal);

  if (activeDay?.notes?.startsWith('LIVE:EARNED:')) {
    if (!activeSession) {
      await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
      await send('A jornada não está mais ativa. Nenhum valor foi lançado.', mainMenu);
      return;
    }
    if (isNaN(num) || num < 0) {
      await send('⚠️ Valor inválido. Informe um valor positivo, por exemplo: 18,50', cancelMenu);
      return;
    }
    const platform = activeDay.notes.split(':')[2];
    const addCents = toCents(num);
    const currentIfoodCents = toCents(activeDay.ifood_earned);
    const currentUberCents = toCents(activeDay.uber_earned);
    const nextIfoodCents = platform === 'IFOOD' ? currentIfoodCents + addCents : currentIfoodCents;
    const nextUberCents = platform === 'UBER' ? currentUberCents + addCents : currentUberCents;
    const update = {
      ifood_earned: fromCents(nextIfoodCents),
      uber_earned: fromCents(nextUberCents),
      total_earned: fromCents(nextIfoodCents + nextUberCents),
      total_deliveries: (Number(activeDay.total_deliveries) || 0) + 1,
      notes: null
    };
    const { data, error } = await (supabaseAdmin.from('work_days').update(update).eq('id', activeDay.id).select().single() as any);
    if (error || !data) {
      console.error('Failed to add live earning:', error);
      await send('Não foi possível registrar o ganho. Tente novamente.', activeJourneyMenu);
      return;
    }
    await send(
      `<b>ENTREGA REGISTRADA</b>\n\niFood: ${formatCurrency(data.ifood_earned)}\nUber: ${formatCurrency(data.uber_earned)}\n<b>Total: ${formatCurrency(data.total_earned)}</b>\nEntregas: <b>${data.total_deliveries}</b>`,
      activeJourneyMenu
    );
    return;
  }

  if (activeDay?.notes === 'LIVE:ODO') {
    if (!activeSession) {
      await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
      await send('A jornada não está mais ativa. O odômetro não foi alterado.', mainMenu);
      return;
    }
    const startOdo = Number(activeDay.odometer_start) || 0;
    if (isNaN(num) || num < startOdo) {
      await send(`⚠️ O odômetro atual não pode ser menor que o inicial (${formatNumberBR(activeDay.odometer_start)} km).`, cancelMenu);
      return;
    }
    const { error } = await (supabaseAdmin.from('work_days').update({ odometer_end: num, notes: null }).eq('id', activeDay.id) as any);
    if (error) {
      console.error('Failed to update live odometer:', error);
      await send('Não foi possível atualizar o odômetro. Tente novamente.', activeJourneyMenu);
      return;
    }
    await send(`Odômetro atualizado: <b>${formatNumberBR(num)} km</b>\nRodados até agora: <b>${formatNumberBR(num - startOdo)} km</b>`, activeJourneyMenu);
    return;
  }

  if (activeDay?.notes?.startsWith('AWAITING:ODO_START_CONFIRM:')) {
    const lastOdo = parseFloat(activeDay.notes.split(':')[2]);
    let odoToUse = null;

    if (textInput.startsWith('USAR ')) {
      odoToUse = lastOdo;
    } else if (textInput === 'OUTRO VALOR') {
      await (supabaseAdmin.from('work_days').update({ notes: 'AWAITING:ODO_START_MANUAL' }).eq('id', activeDay.id) as any);
      await send('Informe o odômetro inicial atual:', cancelMenu);
      return;
    } else if (!isNaN(num)) {
      odoToUse = num;
    }

    if (odoToUse !== null) {
      await (supabaseAdmin.from('work_days').update({ odometer_start: odoToUse, notes: null }).eq('id', activeDay.id) as any);
      await (supabaseAdmin.from('sessions').insert({ work_day_id: activeDay.id, status: 'active' as any }) as any);
      await send(`Jornada iniciada com odômetro <b>${formatNumberBR(odoToUse)} km</b>!`, {
        keyboard: [[{ text: 'ENCERRAR JORNADA' }, { text: 'CANCELAR JORNADA' }], [{ text: 'RESUMO' }], [{ text: 'LIMPAR CHAT' }]],
        resize_keyboard: true
      });
      return;
    }
  }

  if (activeDay?.notes === 'AWAITING:ODO_START_MANUAL' && !isNaN(num)) {
    await (supabaseAdmin.from('work_days').update({ odometer_start: num, notes: null }).eq('id', activeDay.id) as any);
    await (supabaseAdmin.from('sessions').insert({ work_day_id: activeDay.id, status: 'active' as any }) as any);
    await send(`Jornada iniciada com odômetro <b>${formatNumberBR(num)} km</b>!`, {
      ...activeJourneyMenu
    });
    return;
  }

  if (activeDay?.notes?.startsWith('CORRECT:SELECT_SESSION:')) {
    const mode = activeDay.notes.split(':')[2]; // START_TIME or END_TIME
    const sessionMatch = textInput.match(/JORNADA (\d+)/);
    if (sessionMatch) {
      const { data: sessions } = await (supabaseAdmin.from('sessions').select('*').eq('work_day_id', activeDay.id).order('start_time', { ascending: true }) as any);
      const index = parseInt(sessionMatch[1]!) - 1;
      const session = sessions?.[index];
      if (session) {
        await (supabaseAdmin.from('work_days').update({ notes: `CORRECT:${mode}:${session.id}` }).eq('id', activeDay.id) as any);
        await send(`Qual o novo horário de ${mode === 'START_TIME' ? 'início' : 'encerramento'} para a Jornada ${index + 1}?\nExemplo: 09:30`, cancelMenu);
        return;
      }
    }
    await send('Selecione uma jornada válida.', cancelMenu);
    return;
  }

  if (activeDay?.notes?.startsWith('ADDSESSION:')) {
    const mode = activeDay.notes.split(':')[1];
    if (mode === 'START_TIME') {
      if (!isTimeInput) {
        await send('⚠️ Formato de hora inválido. Use HH:MM (ex: 09:30).', cancelMenu);
        return;
      }
      const [h = 0, m = 0] = textInput.split(':').map(Number);
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        await send('⚠️ Hora ou minuto inválido.', cancelMenu);
        return;
      }
      const newStart = new Date(today + 'T00:00:00Z');
      newStart.setUTCHours(h + 3, m, 0, 0); // Convert local to UTC (assuming -3h)
      
      await (supabaseAdmin.from('work_days').update({ notes: `ADDSESSION:ODO_START:${newStart.toISOString()}` }).eq('id', activeDay.id) as any);
      await send('Qual o odômetro inicial desta jornada?', cancelMenu);
      return;
    }
    if (mode === 'ODO_START') {
      const startTime = activeDay.notes.split(':')[2] + ':' + activeDay.notes.split(':')[3] + ':' + activeDay.notes.split(':')[4];
      if (isNaN(num)) {
        await send('⚠️ Valor inválido. Informe o odômetro inicial:', cancelMenu);
        return;
      }
      
      // Check for duplicates
      const { data: existing } = await (supabaseAdmin.from('sessions').select('*').eq('work_day_id', activeDay.id).eq('start_time', startTime) as any);
      if (existing && existing.length > 0) {
        await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
        await send('⚠️ Já existe uma jornada registrada com este horário.', mainMenu);
        return;
      }

      await (supabaseAdmin.from('sessions').insert({ 
        work_day_id: activeDay.id, 
        start_time: startTime,
        status: 'completed' as any,
        end_time: startTime // Default to start time, user can correct later
      }) as any);
      
      await (supabaseAdmin.from('work_days').update({ notes: null }).eq('id', activeDay.id) as any);
      const updatedDay = await getActiveWorkDay();
      const summary = await getSummary(updatedDay);
      await send('Jornada adicionada com sucesso!\n\nNota: O horário de encerramento foi definido igual ao de início. Use CORRIGIR DIA para ajustar se necessário.', mainMenu);
      await send(summary);
      return;
    }
  }

  if (activeDay?.notes?.startsWith('CORRECT:')) {
    const parts = activeDay.notes.split(':');
    const mode = parts[1];
    let update: any = { notes: null };
    
    if (mode === 'START_TIME' || mode === 'END_TIME') {
      if (!isTimeInput) {
        await send('⚠️ Formato de hora inválido. Use HH:MM (ex: 09:30).', cancelMenu);
        return;
      }
      const sessionId = parts[2];
      const [h = 0, m = 0] = textInput.split(':').map(Number);
      const newDate = new Date(today + 'T00:00:00Z');
      newDate.setUTCHours(h + 3, m, 0, 0);

      if (mode === 'START_TIME') {
        await (supabaseAdmin.from('sessions').update({ start_time: newDate.toISOString() }).eq('id', sessionId) as any);
      } else {
        const { data: sess } = await (supabaseAdmin.from('sessions').select('start_time').eq('id', sessionId).single() as any);
        if (newDate < new Date(sess.start_time)) {
          await send('⚠️ O encerramento não pode ser anterior ao início. Informe novamente:', cancelMenu);
          return;
        }
        await (supabaseAdmin.from('sessions').update({ end_time: newDate.toISOString() }).eq('id', sessionId) as any);
      }
    } else if (textInput === 'UBER' || textInput === 'IFOOD') {
      const platform = textInput;
      if (mode === 'EARNED_PLATFORM') {
        await (supabaseAdmin.from('work_days').update({ notes: `CORRECT:EARNED_VALUE:${platform}` }).eq('id', activeDay.id) as any);
        await send(`Qual o valor dos ganhos no ${platform}?`, cancelMenu);
        return;
      }
    } else if (!isNaN(num)) {
      if (mode === 'EARNED_VALUE') {
        if (num < 0) {
          await send('⚠️ O valor dos ganhos não pode ser negativo. Informe novamente:', cancelMenu);
          return;
        }
        const platform = parts[2];
        const isUber = platform === 'UBER';
        
        // Get current values
        const currentUber = Number(activeDay.uber_earned) || 0;
        const currentIfood = Number(activeDay.ifood_earned) || 0;
        
        const newUber = isUber ? num : currentUber;
        const newIfood = !isUber ? num : currentIfood;
        
        update.uber_earned = fromCents(toCents(newUber));
        update.ifood_earned = fromCents(toCents(newIfood));
        update.total_earned = fromCents(toCents(newUber) + toCents(newIfood));
      } else if (mode === 'EARNED') {
      // Fluxo antigo (ganhos totais): redireciona para escolher a plataforma,
      // garantindo que o valor caia em uber_earned/ifood_earned e nunca "vire Extra".
      await (supabaseAdmin.from('work_days').update({ notes: 'CORRECT:EARNED_PLATFORM' }).eq('id', activeDay.id) as any);
      await send('De qual plataforma você deseja corrigir o ganho?', {
        keyboard: [[{ text: 'UBER' }, { text: 'IFOOD' }], [{ text: 'CANCELAR' }]],
        resize_keyboard: true
      });
      return;
    } else if (mode === 'DELIVERIES') {
        update.total_deliveries = Math.round(num);
      } else if (mode === 'ODO_START') {
        update.odometer_start = num;
      } else if (mode === 'ODO_END') {
        if (num < (Number(activeDay.odometer_start) || 0)) {
          await send(`⚠️ O odômetro final não pode ser menor que o inicial (${formatNumberBR(activeDay.odometer_start)}).`, cancelMenu);
          return;
        }
        update.odometer_end = num;
      }
    } else {
      await send('⚠️ Entrada inválida.', cancelMenu);
      return;
    }

    const res = await (supabaseAdmin.from('work_days').update(update).eq('id', activeDay.id).select().single() as any);
    const summary = await getSummary(res.data);
    await send('CORREÇÃO REALIZADA', {
      keyboard: [[{ text: 'CORRIGIR DIA' }, { text: 'LIMPAR CHAT' }, { text: 'RESUMO' }], [{ text: 'MENU' }]],
      resize_keyboard: true
    });
    await send(summary);
    return;
  }

    // 2. Normal Flow
    if (!activeDay || activeDay.odometer_start === null) {
      if (isNaN(num)) {
        await send('⚠️ Valor inválido. Informe o odômetro inicial:', cancelMenu);
        return;
      }
      let day = activeDay;
      if (!day) {
        const res = await (supabaseAdmin.from('work_days').insert({ date: today as any, odometer_start: num, status: 'in_progress' as any }).select().single() as any);
        day = res.data;
      } else {
        await (supabaseAdmin.from('work_days').update({ odometer_start: num, notes: null }).eq('id', day.id) as any);
      }
      if (!day) return;
      await (supabaseAdmin.from('sessions').insert({ work_day_id: day.id, status: 'active' as any }) as any);
      await send('Jornada iniciada!', {
        keyboard: [[{ text: 'ENCERRAR JORNADA' }, { text: 'RESUMO' }]],
        resize_keyboard: true
      });
      return;
    }

    if (activeDay.notes === 'AWAITING:CLOSE_ODO') {
      if (num < (Number(activeDay.odometer_start) || 0)) {
        await send(`⚠️ O odômetro final não pode ser menor que o inicial (${formatNumberBR(activeDay.odometer_start)}). Informe novamente:`, cancelMenu);
        return;
      }
      await (supabaseAdmin.from('work_days').update({ odometer_end: num, notes: 'AWAITING:CLOSE_IFOOD' }).eq('id', activeDay.id) as any);
      await send(`iFood (acumulado: ${formatCurrency(activeDay.ifood_earned)}):`, cancelMenu);
      return;
    }

    if (activeDay.notes === 'AWAITING:CLOSE_IFOOD') {
      if (isNaN(num) || num < 0) {
        await send('⚠️ Valor inválido. Informe o ganho no iFood (ou 0):', cancelMenu);
        return;
      }
      await (supabaseAdmin.from('work_days').update({ ifood_earned: fromCents(toCents(num)), notes: 'AWAITING:CLOSE_UBER' }).eq('id', activeDay.id) as any);
      await send(`Uber (acumulado: ${formatCurrency(activeDay.uber_earned)}):`, cancelMenu);
      return;
    }

    if (activeDay.notes === 'AWAITING:CLOSE_UBER') {
      if (isNaN(num) || num < 0) {
        await send('⚠️ Valor inválido. Informe o ganho na Uber (ou 0):', cancelMenu);
        return;
      }
      const totalEarned = fromCents(toCents(activeDay.ifood_earned) + toCents(num));
      await (supabaseAdmin.from('work_days').update({
        uber_earned: fromCents(toCents(num)),
        total_earned: totalEarned,
        notes: 'AWAITING:CLOSE_DELIVERIES'
      }).eq('id', activeDay.id) as any);

      const updatedDay = await getActiveWorkDay();
      const goalStr = updatedDay.daily_goal !== null ? ` (Meta: ${formatCurrency(updatedDay.daily_goal)})` : '';
      await send(`Quantas entregas você fez hoje? Acumulado: ${updatedDay.total_deliveries ?? 0}${goalStr}`, cancelMenu);
      return;
    }

    if (activeDay.notes === 'AWAITING:CLOSE_DELIVERIES') {
      if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
        await send('⚠️ Valor inválido. Informe o total de entregas:', cancelMenu);
        return;
      }
      const res = await (supabaseAdmin.from('work_days').update({ 
        total_deliveries: Math.round(num), 
        status: 'completed' as any,
        notes: null 
      }).eq('id', activeDay.id).select().single() as any);
      const summary = `Jornada encerrada! iFood: ${formatCurrency(res.data.ifood_earned)} | Uber: ${formatCurrency(res.data.uber_earned)} | Total: ${formatCurrency(res.data.total_earned)}`;
      await send(summary, {
        keyboard: [[{ text: 'CORRIGIR DIA' }, { text: 'LIMPAR CHAT' }, { text: 'RESUMO' }], [{ text: 'MENU' }]],
        resize_keyboard: true
      });
      return;
    }

    // Fallback para lógica antiga caso notes esteja vazio mas o fluxo esteja no meio
    if (activeDay.status === 'in_progress' && activeDay.odometer_end === null) {
      if (num < Number(activeDay.odometer_start)) {
        await send(`⚠️ O odômetro final não pode ser menor que o inicial (${formatNumberBR(activeDay.odometer_start)}). Informe novamente:`, cancelMenu);
        return;
      }
      await (supabaseAdmin.from('work_days').update({ odometer_end: num, notes: 'AWAITING:CLOSE_UBER' }).eq('id', activeDay.id) as any);
      await send('Uber:', cancelMenu);
      return;
    }

    if (activeDay.total_earned === null) {
      // Redireciona para o fluxo por plataforma: Uber e iFood devem ser informados
      // separadamente para nunca caírem no fallback de "Extra" do painel.
      await (supabaseAdmin.from('work_days').update({ notes: 'AWAITING:CLOSE_UBER' }).eq('id', activeDay.id) as any);
      await send('Uber:', cancelMenu);
      return;
    }

    if (activeDay.total_deliveries === null) {
      const res = await (supabaseAdmin.from('work_days').update({ total_deliveries: Math.round(num), status: 'completed' as any }).eq('id', activeDay.id).select().single() as any);
      const summary = await getSummary(res.data);
      await send(`<b>DIA ${formatDateBR(res.data.date)} FECHADO</b>\n\n${summary}`, {
        keyboard: [[{ text: 'CORRIGIR DIA' }, { text: 'RESUMO' }], [{ text: 'MENU' }]],
        resize_keyboard: true
      });
      return;
    }


  await send('Não entendi o comando. Use os botões do menu.', mainMenu);
};