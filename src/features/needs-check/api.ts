/**
 * Gespeicherte Bedarfs-Checks eines angemeldeten Nutzers.
 *
 * Zugriffsschutz liegt in der Datenbank (RLS auf `needs_check_results`,
 * `user_id = auth.uid()`), nicht in diesem Modul. `user_id` wird nie vom
 * Client gesetzt, sondern per Spalten-Default aus der Sitzung. Jede gelesene
 * Zeile wird erneut geprüft; ungültige Zeilen werden verworfen.
 */
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { NEEDS_CHECK_VERSION, parseNeedsAnswers, type NeedsAnswers } from '@/shared/needs-check';

export interface SavedNeedsCheck {
  id: string;
  answers: NeedsAnswers;
  createdAt: string;
}

export type NeedsCheckApiErrorCode = 'not_configured' | 'limit_reached' | 'backend';

export class NeedsCheckApiError extends Error {
  readonly code: NeedsCheckApiErrorCode;

  constructor(code: NeedsCheckApiErrorCode, message: string) {
    super(message);
    this.name = 'NeedsCheckApiError';
    this.code = code;
  }
}

const TABLE = 'needs_check_results';
const COLUMNS = 'id, answers, created_at';

function client() {
  if (!isSupabaseConfigured()) {
    throw new NeedsCheckApiError('not_configured', 'Speichern ist in dieser Umgebung nicht eingerichtet.');
  }
  return getSupabase();
}

function toSaved(row: unknown): SavedNeedsCheck | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const answers = parseNeedsAnswers(r.answers);
  if (!answers || typeof r.id !== 'string' || typeof r.created_at !== 'string') return null;
  return { id: r.id, answers, createdAt: r.created_at };
}

/** Speichert die Antworten. Gibt die vom Backend bestätigte Zeile zurück. */
export async function saveNeedsCheck(answers: NeedsAnswers): Promise<SavedNeedsCheck> {
  const { data, error } = await client()
    .from(TABLE)
    .insert({ answers, version: NEEDS_CHECK_VERSION })
    .select(COLUMNS)
    .single();
  if (error) {
    if (typeof error.message === 'string' && error.message.includes('needs_check_limit')) {
      throw new NeedsCheckApiError(
        'limit_reached',
        'Es sind bereits 20 Ergebnisse gespeichert. Bitte löschen Sie ein älteres Ergebnis.',
      );
    }
    throw new NeedsCheckApiError('backend', 'Das Ergebnis konnte nicht gespeichert werden.');
  }
  const saved = toSaved(data);
  if (!saved) throw new NeedsCheckApiError('backend', 'Das Backend hat das Speichern nicht bestätigt.');
  return saved;
}

/** Lädt die eigenen gespeicherten Ergebnisse, neueste zuerst. */
export async function listNeedsChecks(): Promise<SavedNeedsCheck[]> {
  const { data, error } = await client()
    .from(TABLE)
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new NeedsCheckApiError('backend', 'Gespeicherte Ergebnisse konnten nicht geladen werden.');
  const rows: unknown[] = Array.isArray(data) ? data : [];
  return rows.map(toSaved).filter((r): r is SavedNeedsCheck => r !== null);
}

/** Löscht ein eigenes Ergebnis. Fremde Zeilen trifft die Abfrage wegen RLS nicht. */
export async function deleteNeedsCheck(id: string): Promise<void> {
  const { data, error } = await client().from(TABLE).delete().eq('id', id).select('id');
  if (error) throw new NeedsCheckApiError('backend', 'Das Ergebnis konnte nicht gelöscht werden.');
  if (!Array.isArray(data) || data.length !== 1) {
    throw new NeedsCheckApiError('backend', 'Das Ergebnis wurde nicht gefunden oder gehört nicht zu Ihrem Konto.');
  }
}
