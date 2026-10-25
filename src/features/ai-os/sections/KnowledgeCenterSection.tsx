// Wissen — Wissensbasis docs/ai-os durchsuchen, lesen, verknüpfen und
// bearbeiten. Quelle ist der Hauptzweig in GitHub (versioniert); Änderungen
// werden als Draft-PR vorgeschlagen und wirken erst nach Review und Merge.

import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FilePlus, Pencil, Search } from 'lucide-react';
import { findSecretLikeContent, isAllowedKnowledgePath, KNOWLEDGE_ROOT, parseFrontmatter } from '../../../../packages/ai-os-core/src/index';
import { callAiOs, DENY_HINT, useAiOsResource } from '../aiOsApi';
import type { AiOsSession } from '../AiOsCommandCenter';
import { ConfirmDialog, Empty, Note, Panel, Pill, ReloadButton, ResourceView, useActionState } from '../ui';

export interface KnowledgeNote { path: string; sha?: string; url?: string; content: string | null; tooLarge?: boolean }
interface KnowledgeResponse { configured?: boolean; message?: string; root: string; notes: KnowledgeNote[]; omitted: number }

/** Relative Markdown-Links einer Notiz, aufgelöst auf Repo-Pfade. */
export function outgoingLinks(note: KnowledgeNote): string[] {
  if (!note.content) return [];
  const dir = note.path.split('/').slice(0, -1);
  const out = new Set<string>();
  for (const m of note.content.matchAll(/\]\(([^)#\s]+\.md)(#[^)]*)?\)/g)) {
    const target = m[1];
    if (/^[a-z]+:/i.test(target)) continue;
    const parts = target.startsWith('/') ? target.slice(1).split('/') : [...dir, ...target.split('/')];
    const stack: string[] = [];
    for (const p of parts) {
      if (p === '..') stack.pop();
      else if (p !== '.' && p !== '') stack.push(p);
    }
    out.add(stack.join('/'));
  }
  return [...out];
}

function titleOf(note: KnowledgeNote): string {
  if (!note.content) return note.path;
  const { meta, body } = parseFrontmatter(note.content);
  return meta.title ?? /^#[ \t]+(\S.*)$/m.exec(body)?.[1] ?? note.path.split('/').pop()!;
}

function Editor({ session, initial, onDone }: {
  session: AiOsSession;
  initial: { path: string; content: string; isNew: boolean };
  onDone: (prUrl: string | null) => void;
}) {
  const [path, setPath] = useState(initial.path);
  const [content, setContent] = useState(initial.content);
  const [summary, setSummary] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { busy, setBusy, feedback, setFeedback } = useActionState();
  const secrets = findSecretLikeContent(content);
  const pathOk = isAllowedKnowledgePath(path);
  const blocked = !session.githubConfigured ? 'GitHub nicht verbunden' : session.aal !== 'aal2' ? 'Vorschläge erfordern 2FA (AAL2)' : null;
  const canSubmit = !blocked && pathOk && summary.trim().length > 0 && content.trim().length > 0 && secrets.length === 0;

  async function submit() {
    setBusy(true);
    const r = await callAiOs<{ pr: { number: number; url: string } | null }>('knowledge_propose', { path, content, summary, confirmed: true });
    setBusy(false);
    setConfirm(false);
    if (r.ok) onDone(r.data.pr?.url ?? null);
    else setFeedback({ tone: 'fail', text: DENY_HINT[r.code] ?? `${r.code}: ${r.message}` });
  }

  return (
    <Panel title={initial.isNew ? 'Neue Notiz' : 'Notiz bearbeiten'}>
      <label className="block text-sm">Pfad
        <input className="aios-input aios-mono mt-1" value={path} onChange={(e) => setPath(e.target.value)} disabled={!initial.isNew} />
      </label>
      {!pathOk && <p className="text-xs" style={{ color: 'var(--aios-fail)' }}>Nur Markdown unter <span className="aios-mono">{KNOWLEDGE_ROOT}</span>, Kleinbuchstaben, Ziffern, Bindestriche.</p>}
      <label className="block text-sm">Inhalt (Markdown, Obsidian-kompatibel)
        <textarea className="aios-textarea mt-1" value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      {secrets.length > 0 && <Note tone="fail">Zugangsdaten-Muster erkannt ({secrets.join(', ')}). Solche Inhalte gehören nicht ins Repository.</Note>}
      <label className="block text-sm">Zusammenfassung der Änderung (PR-Titel)
        <input className="aios-input mt-1" maxLength={120} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
      {blocked && <p className="text-xs aios-muted">{blocked}.</p>}
      {feedback && <Note tone={feedback.tone}>{feedback.text}</Note>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="aios-btn" data-variant="primary" disabled={!canSubmit || busy} onClick={() => setConfirm(true)}>Als Draft-PR vorschlagen</button>
        <button type="button" className="aios-btn" onClick={() => onDone(null)} disabled={busy}>Abbrechen</button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Änderung als Draft-PR vorschlagen?"
          body={<p>Legt einen Branch und einen Draft-Pull-Request für <span className="aios-mono">{path}</span> an. Auf main wirkt die Änderung erst nach Review und Merge.</p>}
          confirmLabel="PR anlegen"
          onConfirm={submit}
          onCancel={() => setConfirm(false)}
          busy={busy}
        />
      )}
    </Panel>
  );
}

const TEMPLATE = (today: string) => `---\ntitle: Neue Notiz\nowner: Plattform-Betrieb\nreviewed: ${today}\nstatus: entwurf\n---\n\n# Neue Notiz\n\nQuelle der Wahrheit verlinken statt kopieren.\n`;

export function KnowledgeCenterSection({ session }: { session: AiOsSession }) {
  const res = useAiOsResource<KnowledgeResponse>('knowledge_list');
  const [query, setQuery] = useState('');
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ path: string; content: string; isNew: boolean } | null>(null);
  const [lastPr, setLastPr] = useState<string | null>(null);

  const notes = res.result?.ok && res.result.data.notes ? res.result.data.notes : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.path.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q));
  }, [notes, query]);
  const open = notes.find((n) => n.path === openPath) ?? null;
  const backlinks = open ? notes.filter((n) => n.path !== open.path && outgoingLinks(n).includes(open.path)) : [];
  const links = open ? outgoingLinks(open) : [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aios-h1">Wissen</h1>
          <p className="aios-lead">
            Projektwissen aus <span className="aios-mono">{KNOWLEDGE_ROOT}</span> auf main. Bearbeiten erzeugt einen Draft-PR — so
            bleibt jede Änderung versioniert und geprüft. In Obsidian lässt sich derselbe Ordner als Vault öffnen.
          </p>
        </div>
        <div className="flex gap-2">
          <ReloadButton onClick={res.reload} loading={res.loading} />
          <button type="button" className="aios-btn" onClick={() => setEditing({ path: `${KNOWLEDGE_ROOT}wissen/neue-notiz.md`, content: TEMPLATE(new Date().toISOString().slice(0, 10)), isNew: true })}>
            <FilePlus className="h-4 w-4" /> Neue Notiz
          </button>
        </div>
      </div>

      {lastPr && <Note tone="ok">Draft-PR angelegt: <a className="aios-link" href={lastPr} target="_blank" rel="noreferrer">{lastPr}</a></Note>}

      {editing ? (
        <Editor session={session} initial={editing} onDone={(url) => { setEditing(null); if (url) setLastPr(url); }} />
      ) : (
        <ResourceView resource={res}>
          {(data) => (
            <div className="aios-grid-wide" style={{ alignItems: 'start' }}>
              <Panel title={`Notizen (${data.notes.length}${data.omitted ? `, ${data.omitted} weitere nicht geladen` : ''})`} source="GitHub Contents API · main">
                <label className="flex items-center gap-2">
                  <Search className="h-4 w-4 aios-muted" aria-hidden="true" />
                  <span className="sr-only">Wissen durchsuchen</span>
                  <input className="aios-input" placeholder="Volltextsuche …" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                {filtered.length === 0 ? <Empty>Keine Treffer.</Empty> : (
                  <ul className="space-y-1">
                    {filtered.map((n) => (
                      <li key={n.path}>
                        <button type="button" className="text-left w-full aios-btn" style={{ justifyContent: 'flex-start' }} aria-pressed={openPath === n.path} onClick={() => setOpenPath(n.path)}>
                          <span className="truncate">{titleOf(n)}</span>
                        </button>
                        <div className="text-xs aios-muted aios-mono truncate px-1">{n.path}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <div className="space-y-3">
                {!open ? <Panel><Empty>Notiz links auswählen.</Empty></Panel> : (
                  <Panel
                    title={titleOf(open)}
                    actions={open.content !== null && (
                      <button type="button" className="aios-btn" onClick={() => setEditing({ path: open.path, content: open.content!, isNew: false })}>
                        <Pencil className="h-4 w-4" /> Bearbeiten
                      </button>
                    )}
                    source={open.path}
                  >
                    {(() => {
                      if (open.content === null) return <Empty>Datei zu groß für die Anzeige.</Empty>;
                      const { meta, body } = parseFrontmatter(open.content);
                      return (
                        <>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {meta.owner && <Pill tone="neutral">Verantwortlich: {meta.owner}</Pill>}
                            {meta.reviewed && <Pill tone="neutral">Geprüft: {meta.reviewed}</Pill>}
                            {meta.status && <Pill tone="info">{meta.status}</Pill>}
                            {open.url && <a className="aios-link" href={open.url} target="_blank" rel="noreferrer">in GitHub</a>}
                          </div>
                          <div className="aios-md"><ReactMarkdown>{body}</ReactMarkdown></div>
                        </>
                      );
                    })()}
                    <div className="text-sm">
                      <div className="font-semibold">Verknüpft mit</div>
                      {links.length === 0 ? <Empty>Keine Links auf andere Notizen.</Empty> : (
                        <ul className="list-disc pl-5">
                          {links.map((l) => <li key={l}>{notes.some((n) => n.path === l) ? <button type="button" className="aios-link" onClick={() => setOpenPath(l)}>{l}</button> : <span className="aios-mono">{l}</span>}</li>)}
                        </ul>
                      )}
                      <div className="font-semibold mt-2">Verlinkt von</div>
                      {backlinks.length === 0 ? <Empty>Keine Rückverweise.</Empty> : (
                        <ul className="list-disc pl-5">{backlinks.map((b) => <li key={b.path}><button type="button" className="aios-link" onClick={() => setOpenPath(b.path)}>{titleOf(b)}</button></li>)}</ul>
                      )}
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          )}
        </ResourceView>
      )}
    </>
  );
}
