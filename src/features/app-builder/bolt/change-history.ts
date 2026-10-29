/**
 * Diff + undo per AI change (P1).
 *
 * Inspired by bolt.diy's per-message file diff / revert (MIT,
 * stackblitz-labs/bolt.diy). RealSync-specific: undo never writes the
 * FileStore directly — it goes through BoltEngine.restore(), i.e. the
 * fail-closed governance gate, the audit trail and a new Merkle snapshot.
 * History is append-only; an undo is a new audited change, never a rewrite.
 */

export type FileMap = Record<string, string>;

export interface LineDiffOp {
  op: 'eq' | 'add' | 'del';
  line: string;
}

export interface FileChange {
  path: string;
  kind: 'added' | 'modified' | 'deleted';
  added: number;
  removed: number;
  /** Unified-style ops; empty when the file exceeds MAX_DIFF_LINES. */
  ops: LineDiffOp[];
}

export interface ChangeEntry {
  id: string;
  label: string;
  at: string;
  before: FileMap;
  after: FileMap;
  changes: FileChange[];
  merkleBefore: string;
  merkleAfter: string;
  undone: boolean;
}

export const MAX_DIFF_LINES = 2000;
export const MAX_HISTORY = 20;

/** Myers-free LCS line diff. Bounded by MAX_DIFF_LINES to stay cheap in the browser. */
export function diffLines(a: string, b: string): LineDiffOp[] {
  const A = a === '' ? [] : a.split('\n');
  const B = b === '' ? [] : b.split('\n');
  if (A.length > MAX_DIFF_LINES || B.length > MAX_DIFF_LINES) return [];
  const n = A.length;
  const m = B.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: LineDiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      ops.push({ op: 'eq', line: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: 'del', line: A[i++] });
    } else {
      ops.push({ op: 'add', line: B[j++] });
    }
  }
  while (i < n) ops.push({ op: 'del', line: A[i++] });
  while (j < m) ops.push({ op: 'add', line: B[j++] });
  return ops;
}

function countLines(s: string): number {
  return s === '' ? 0 : s.split('\n').length;
}

export function diffFileMaps(before: FileMap, after: FileMap): FileChange[] {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const out: FileChange[] = [];
  for (const path of paths) {
    const had = Object.prototype.hasOwnProperty.call(before, path);
    const has = Object.prototype.hasOwnProperty.call(after, path);
    if (had && has && before[path] === after[path]) continue;
    const ops = diffLines(had ? before[path] : '', has ? after[path] : '');
    const tooLarge = ops.length === 0 && (countLines(before[path] ?? '') > 0 || countLines(after[path] ?? '') > 0);
    out.push({
      path,
      kind: !had ? 'added' : !has ? 'deleted' : 'modified',
      added: tooLarge ? countLines(after[path] ?? '') : ops.filter((o) => o.op === 'add').length,
      removed: tooLarge ? countLines(before[path] ?? '') : ops.filter((o) => o.op === 'del').length,
      ops,
    });
  }
  return out;
}

export function makeChangeEntry(args: {
  id: string;
  label: string;
  before: FileMap;
  after: FileMap;
  merkleBefore: string;
  merkleAfter: string;
  at?: string;
}): ChangeEntry | null {
  const changes = diffFileMaps(args.before, args.after);
  if (changes.length === 0) return null;
  return {
    id: args.id,
    label: args.label.slice(0, 200),
    at: args.at ?? new Date().toISOString(),
    before: { ...args.before },
    after: { ...args.after },
    changes,
    merkleBefore: args.merkleBefore,
    merkleAfter: args.merkleAfter,
    undone: false,
  };
}

export function pushHistory(history: ChangeEntry[], entry: ChangeEntry | null): ChangeEntry[] {
  if (!entry) return history;
  return [...history, entry].slice(-MAX_HISTORY);
}

/**
 * Only the newest not-yet-undone change may be undone, and only if the
 * current tree still equals its `after` state (no silent clobbering of
 * later manual edits).
 */
export function canUndo(history: ChangeEntry[], current: FileMap): ChangeEntry | null {
  for (let k = history.length - 1; k >= 0; k--) {
    const e = history[k];
    if (e.undone) continue;
    return diffFileMaps(e.after, current).length === 0 ? e : null;
  }
  return null;
}

export function markUndone(history: ChangeEntry[], id: string): ChangeEntry[] {
  return history.map((e) => (e.id === id ? { ...e, undone: true } : e));
}
