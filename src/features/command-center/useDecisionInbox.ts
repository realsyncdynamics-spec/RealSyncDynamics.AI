import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import type { AgentQuestionRow, QuestionEventRow } from './decisionInbox';

export interface DecisionInboxState {
  questions: AgentQuestionRow[];
  events: QuestionEventRow[];
  loading: boolean;
  /** Ehrliche Meldung, wenn die Quelle nicht lesbar ist (z. B. Migration noch nicht live). */
  sourceError: string | null;
}

export function useDecisionInbox(): DecisionInboxState {
  const [state, setState] = useState<DecisionInboxState>({ questions: [], events: [], loading: true, sourceError: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) {
        setState({ questions: [], events: [], loading: false, sourceError: 'Supabase nicht konfiguriert' });
        return;
      }
      const sb = getSupabase();
      const { data, error } = await sb
        .from('agent_questions')
        .select('id,agent_ref,task_ref,milestone,project,question,context,priority,status,dedupe_key,is_demo,created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        setState({ questions: [], events: [], loading: false, sourceError: `Fragen nicht lesbar: ${error.message}` });
        return;
      }
      const questions = (data ?? []) as AgentQuestionRow[];
      let events: QuestionEventRow[] = [];
      if (questions.length > 0) {
        const ev = await sb
          .from('agent_question_events')
          .select('question_id,event_type,from_value,to_value,created_at')
          .in('question_id', questions.map((x) => x.id))
          .order('created_at', { ascending: true });
        if (cancelled) return;
        events = (ev.data ?? []) as QuestionEventRow[];
      }
      setState({ questions, events, loading: false, sourceError: null });
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
