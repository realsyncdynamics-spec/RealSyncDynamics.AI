// In-memory store for trainer state.
//
// All 6 record types from the spec live here:
//   - AgentProfile
//   - QualityReview
//   - TrainingSession
//   - HandoffPacket
//   - RotationLog
//   - LearningNote
//
// The store is intentionally simple: process-local Maps + a small
// `persist` hook. Phase B replaces this with Postgres-backed tables
// (see `agent_profiles`, `agent_training_sessions`,
// `agent_handoffs`, `agent_rotation_log`, `agent_quality_reviews`
// in the spec).

import type {
  AgentProfile, QualityReview, TrainingSession,
  HandoffPacket, RotationLog, LearningNote, PeerHelpRequest,
} from './types';

interface AnyPersistHook {
  saveProfile?:        (p: AgentProfile)     => Promise<void> | void;
  saveReview?:         (r: QualityReview)    => Promise<void> | void;
  saveTraining?:       (t: TrainingSession)  => Promise<void> | void;
  saveHandoff?:        (h: HandoffPacket)    => Promise<void> | void;
  saveRotation?:       (r: RotationLog)      => Promise<void> | void;
  saveNote?:           (n: LearningNote)     => Promise<void> | void;
  savePeerHelp?:       (p: PeerHelpRequest)  => Promise<void> | void;
}

export class TrainerStore {
  private profiles  = new Map<string, AgentProfile>();
  private reviews   = new Map<string, QualityReview>();
  private trainings = new Map<string, TrainingSession>();
  private handoffs  = new Map<string, HandoffPacket>();
  private rotations = new Map<string, RotationLog>();
  private notes     = new Map<string, LearningNote>();
  private peerHelps = new Map<string, PeerHelpRequest>();
  private hook: AnyPersistHook | null = null;

  setPersistHook(hook: AnyPersistHook | null): void {
    this.hook = hook;
  }

  // ── Profiles ───────────────────────────────────────────────────

  upsertProfile(p: AgentProfile): AgentProfile {
    this.profiles.set(p.name, p);
    void this.hook?.saveProfile?.(p);
    return p;
  }

  getProfile(name: string): AgentProfile | null {
    return this.profiles.get(name) ?? null;
  }

  listProfiles(): AgentProfile[] {
    return [...this.profiles.values()];
  }

  // ── Reviews ────────────────────────────────────────────────────

  saveReview(r: QualityReview): QualityReview {
    this.reviews.set(r.id, r);
    void this.hook?.saveReview?.(r);
    return r;
  }

  listReviewsForAgent(agent_name: string): QualityReview[] {
    return [...this.reviews.values()].filter(r => r.agent_name === agent_name);
  }

  // ── Training sessions ──────────────────────────────────────────

  saveTraining(t: TrainingSession): TrainingSession {
    this.trainings.set(t.id, t);
    void this.hook?.saveTraining?.(t);
    return t;
  }

  listTrainingsForAgent(agent_name: string): TrainingSession[] {
    return [...this.trainings.values()].filter(t => t.agent_name === agent_name);
  }

  setTrainingScoreAfter(id: string, score_after: number): TrainingSession | null {
    const t = this.trainings.get(id);
    if (!t) return null;
    const updated = { ...t, score_after };
    this.trainings.set(id, updated);
    void this.hook?.saveTraining?.(updated);
    return updated;
  }

  // ── Handoffs ───────────────────────────────────────────────────

  saveHandoff(h: HandoffPacket): HandoffPacket {
    this.handoffs.set(h.id, h);
    void this.hook?.saveHandoff?.(h);
    return h;
  }

  listHandoffsForAgent(agent_name: string, role: 'source' | 'target' | 'either' = 'either'): HandoffPacket[] {
    return [...this.handoffs.values()].filter(h => {
      if (role === 'source') return h.source_agent === agent_name;
      if (role === 'target') return h.target_agent === agent_name;
      return h.source_agent === agent_name || h.target_agent === agent_name;
    });
  }

  // ── Rotations ──────────────────────────────────────────────────

  saveRotation(r: RotationLog): RotationLog {
    this.rotations.set(r.id, r);
    void this.hook?.saveRotation?.(r);
    return r;
  }

  listRotationsForAgent(agent_name: string): RotationLog[] {
    return [...this.rotations.values()].filter(r => r.agent_name === agent_name);
  }

  // ── Learning notes ─────────────────────────────────────────────

  saveNote(n: LearningNote): LearningNote {
    this.notes.set(n.id, n);
    void this.hook?.saveNote?.(n);
    return n;
  }

  listNotes(filter?: { about_agent?: string; tag?: string }): LearningNote[] {
    return [...this.notes.values()].filter(n => {
      if (filter?.about_agent && n.about_agent !== filter.about_agent) return false;
      if (filter?.tag && !n.tags.includes(filter.tag)) return false;
      return true;
    });
  }

  // ── Peer help requests ─────────────────────────────────────────

  savePeerHelp(p: PeerHelpRequest): PeerHelpRequest {
    this.peerHelps.set(p.id, p);
    void this.hook?.savePeerHelp?.(p);
    return p;
  }

  listOpenPeerHelps(): PeerHelpRequest[] {
    return [...this.peerHelps.values()].filter(p => p.status === 'open');
  }

  // ── Test helper ────────────────────────────────────────────────

  __resetForTests(): void {
    this.profiles.clear();
    this.reviews.clear();
    this.trainings.clear();
    this.handoffs.clear();
    this.rotations.clear();
    this.notes.clear();
    this.peerHelps.clear();
    this.hook = null;
  }
}
