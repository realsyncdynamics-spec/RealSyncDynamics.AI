import type { AgentTaskRow } from '../../src/features/command-center/taskBoard';

export const mk = (id: string, p: Partial<AgentTaskRow> = {}): AgentTaskRow => ({
  id, agent: 'a', task: `Aufgabe ${id}`, priority: 'normal', status: 'open', board_status: null, project: null,
  correlation_id: null, parent_task_id: null, depends_on: [], evidence: [], claimed_by: null, claim_expires_at: null,
  blocker_reason: null, created_at: '2026-10-30T10:00:00Z', ...p,
});
