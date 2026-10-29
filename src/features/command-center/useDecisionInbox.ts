import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import type { AgentQuestionRow, DecisionRow, QuestionEventRow } from './decisionInbox';

export interface DecisionInboxState {
  questions: AgentQuestionRow[];
  events: QuestionEventRow[];
  decisions: Record<string, DecisionRow>;
  loading: boolean;
  /** Ehrliche Meldung, wenn die Quelle nicht lesbar ist (z. B. Migration noch nicht live). */
  sourceError: string | null;
}

export function useDecisionInbox(): DecisionInboxState {
  const [state, setState] = useState<DecisionInboxState>({ questions: [], events: [], decisions: {}, loading: true, sourceError: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) {
        setState({ questions: [], events: [], decisions: {}, loading: false, sourceError: 'Supabase nicht konfiguriert' });
        return;
      }
      const sb = getSupabase();
      const { data, error } = await sb
        .from('agent_questions')
        .select('id,agent_ref,task_ref,milestone,project,question,context,priority,status,dedupe_key,is_demo,created_at,decision_id')
        .eq('status', 'open')
        .order('created_at', { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        setState({ questions: [], events: [], decisions: {}, loading: false, sourceError: `Fragen nicht lesbar: ${error.message}` });
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
      const decisionIds = questions.map((x) => x.decision_id).filter((x): x is string => Boolean(x));
      const decisions: Record<string, DecisionRow> = {};
      if (decisionIds.length > 0) {
        const dr = await sb
          .from('agent_decisions')
          .select('id,options,recommendation,reason,risk_level,reversibility,status,proposed_by')
          .in('id', decisionIds);
        if (cancelled) return;
        for (const d of (dr.data ?? []) as DecisionRow[]) decisions[d.id] = d;
      }
      setState({ questions, events, decisions, loading: false, sourceError: null });
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
