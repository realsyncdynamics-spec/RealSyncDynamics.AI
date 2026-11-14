import { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, Redo2, Save, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SovereignButton } from '../../components/ui/SovereignButton';
import { useOptionalTenant } from '../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { brandKitFromTenant, demoBrandKit, resolveToken, BRAND_COLOR_TOKENS, type BrandColorToken, type BrandKit } from './brandKit';
import { EditorCanvas, type EditorCanvasHandle } from './EditorCanvas';
import { downloadDataUrl, readImageFile } from './exportPng';
import { SOCIAL_FORMATS, formatById, type SocialFormatId } from './formats';
import {
  addLayer,
  commitDocument,
  createImageLayer,
  createLogoLayer,
  createShapeLayer,
  createTextLayer,
  designFileJson,
  designJsonByteLength,
  MAX_DESIGN_JSON_BYTES,
  moveLayer,
  parseSocialDesign,
  pngFileName,
  redoDocument,
  removeLayer,
  replaceDocument,
  scaleDocumentToFormat,
  undoDocument,
  updateLayer,
  type DesignLayer,
  type HistoryState,
  type SocialDesignDocument,
} from './model';
import { insertSocialDesign, listSocialDesigns, toSocialDesignRow, updateSocialDesign, type SavedDesignSummary } from './persistence';
import { SOCIAL_TEMPLATES, documentFromTemplate } from './templates';

function historyOf(document: SocialDesignDocument): HistoryState {
  return { past: [], present: document, future: [] };
}

export function SocialDesignEditor() {
  const tenant = useOptionalTenant();
  const activeTenantId = tenant?.activeTenantId ?? null;
  const canvasRef = useRef<EditorCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kit, setKit] = useState<BrandKit>(() => demoBrandKit());
  const [history, setHistory] = useState<HistoryState>(() => historyOf(createInitial()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<SavedDesignSummary[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const design = history.present;
  const selected = design.layers.find((layer) => layer.id === selectedId) ?? null;
  const format = formatById(design.formatId);

  useEffect(() => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setKit(demoBrandKit());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await getSupabase()
        .from('tenants')
        .select('company_name, brand_colors, custom_logo_url, custom_css')
        .eq('id', activeTenantId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setKit(demoBrandKit());
        setStatus(error ? 'Brand-Kit konnte nicht geladen werden. Demo-Brand-Kit ist aktiv.' : null);
        return;
      }
      setKit(brandKitFromTenant(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        setHistory((current) => (event.shiftKey ? redoDocument(current) : undoDocument(current)));
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        setHistory((current) => redoDocument(current));
        return;
      }
      if (!typing && selectedId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        commit((current) => removeLayer(current, selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  function commit(change: (current: SocialDesignDocument) => SocialDesignDocument) {
    setHistory((current) => commitDocument(current, change(current.present)));
  }

  function changeFormat(formatId: SocialFormatId) {
    commit((current) => scaleDocumentToFormat(current, formatId));
  }

  function paint(token: BrandColorToken) {
    if (!selected) {
      commit((current) => ({ ...current, backgroundToken: token }));
      return;
    }
    if (selected.kind === 'text' || selected.kind === 'shape') {
      commit((current) => updateLayer(current, selected.id, { fillToken: token }));
    }
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    try {
      const src = await readImageFile(file);
      let added: string | null = null;
      commit((current) => {
        const layer = createImageLayer(current, src);
        added = layer.id;
        return addLayer(current, layer);
      });
      setSelectedId(added);
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Bild konnte nicht geladen werden');
    }
  }

  async function exportPng() {
    setBusy(true);
    setStatus(null);
    try {
      const url = await canvasRef.current?.exportPng();
      if (!url) throw new Error('Export ist nicht bereit');
      downloadDataUrl(pngFileName(design), url);
      setStatus(`PNG ${format.width}×${format.height}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  function downloadJson() {
    const json = designFileJson(design, kit);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(`${pngFileName(design).replace(/\.png$/, '')}.json`, url);
    URL.revokeObjectURL(url);
    setStatus('JSON-Datei heruntergeladen');
  }

  async function saveToTenant() {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setStatus('Ohne Mandant bleibt das Design lokal. JSON-Datei nutzen.');
      return;
    }
    if (designJsonByteLength(design) > MAX_DESIGN_JSON_BYTES) {
      setStatus('Design-JSON ist zu groß zum Speichern');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const { data, error } = await getSupabase().auth.getUser();
      if (error || !data.user) throw new Error('Nicht angemeldet');
      const row = toSocialDesignRow(design, kit, activeTenantId, data.user.id);
      if (persisted) await updateSocialDesign(getSupabase(), row);
      else await insertSocialDesign(getSupabase(), row);
      setPersisted(true);
      setStatus('Im Mandanten gespeichert');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryError(null);
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLibrary([]);
      setLibraryError('Ohne Mandant gibt es keine gespeicherten Designs.');
      return;
    }
    try {
      setLibrary(await listSocialDesigns(getSupabase(), activeTenantId));
    } catch (error) {
      setLibrary([]);
      setLibraryError(error instanceof Error ? error.message : 'Liste fehlgeschlagen');
    }
  }

  function loadSaved(row: SavedDesignSummary) {
    try {
      const next = parseSocialDesign(row.konva_json);
      setHistory(replaceDocument({ ...next, id: row.id, title: row.title || next.title }));
      setPersisted(true);
      setSelectedId(null);
      setLibraryOpen(false);
      setStatus('Design geladen');
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'Design-JSON ist ungültig');
    }
  }

  function applyTemplate(templateId: string) {
    const next = documentFromTemplate(templateId);
    setHistory(replaceDocument(next));
    setPersisted(false);
    setSelectedId(null);
    setTemplatesOpen(false);
    setStatus('Vorlage eingesetzt. Farben folgen dem Brand-Kit.');
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-obsidian-950 text-titanium-100">
      <header className="flex flex-wrap items-end gap-3 border-b border-titanium-900 px-4 py-3">
        <div className="min-w-[220px] flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
            AI Creative Studio · Bereich C
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-titanium-50">Social Design</h1>
            {kit.source === 'demo' && <Badge variant="warning" size="sm">Demo-Brand-Kit</Badge>}
            <Badge variant="secondary" size="sm">Beta</Badge>
          </div>
        </div>
        <Input
          label="Titel"
          size="sm"
          value={design.title}
          onChange={(event) => commit((current) => ({ ...current, title: event.target.value.slice(0, 160) }))}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <SovereignButton size="sm" variant="ghost" aria-label="Rückgängig" disabled={history.past.length === 0} onClick={() => setHistory(undoDocument)}>
            <Undo2 className="h-4 w-4" />
          </SovereignButton>
          <SovereignButton size="sm" variant="ghost" aria-label="Wiederholen" disabled={history.future.length === 0} onClick={() => setHistory(redoDocument)}>
            <Redo2 className="h-4 w-4" />
          </SovereignButton>
          <SovereignButton size="sm" variant="outline" onClick={downloadJson}>JSON</SovereignButton>
          <SovereignButton size="sm" variant="outline" loading={busy} onClick={() => void saveToTenant()} leftIcon={<Save className="h-4 w-4" />}>
            Speichern
          </SovereignButton>
          <SovereignButton size="sm" variant="primary" loading={busy} onClick={() => void exportPng()} leftIcon={<Download className="h-4 w-4" />}>
            PNG
          </SovereignButton>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-titanium-900 px-4 py-2">
        {SOCIAL_FORMATS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === design.formatId}
            onClick={() => changeFormat(entry.id)}
            className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
              entry.id === design.formatId
                ? 'border-security-blue text-security-blue'
                : 'border-titanium-800 text-titanium-400 hover:border-titanium-600'
            }`}
          >
            {entry.label} {entry.width}×{entry.height}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
        <aside className="flex flex-col gap-4 border-b border-titanium-900 p-3 lg:border-b-0 lg:border-r">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">Ebenen anlegen</p>
            <div className="flex flex-wrap gap-2">
              <SovereignButton size="sm" variant="subtle" onClick={() => {
                const layer = createTextLayer(design);
                commit((current) => addLayer(current, layer));
                setSelectedId(layer.id);
              }} leftIcon={<Type className="h-3.5 w-3.5" />}>Text</SovereignButton>
              <SovereignButton size="sm" variant="subtle" onClick={() => fileRef.current?.click()} leftIcon={<ImagePlus className="h-3.5 w-3.5" />}>Bild</SovereignButton>
              <SovereignButton size="sm" variant="subtle" onClick={() => {
                const layer = createShapeLayer(design, 'rect');
                commit((current) => addLayer(current, layer));
                setSelectedId(layer.id);
              }} leftIcon={<Square className="h-3.5 w-3.5" />}>Form</SovereignButton>
              <SovereignButton size="sm" variant="subtle" onClick={() => {
                const layer = createShapeLayer(design, 'ellipse');
                commit((current) => addLayer(current, layer));
                setSelectedId(layer.id);
              }}>Ellipse</SovereignButton>
              <SovereignButton size="sm" variant="subtle" onClick={() => {
                const layer = createLogoLayer(design);
                commit((current) => addLayer(current, layer));
                setSelectedId(layer.id);
              }}>Logo</SovereignButton>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                void onUpload(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">Reihenfolge</p>
            <ul className="space-y-1">
              {[...design.layers].reverse().map((layer) => (
                <li key={layer.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(layer.id)}
                    className={`flex w-full items-center justify-between border px-2 py-1 text-left text-xs ${
                      layer.id === selectedId ? 'border-security-blue text-titanium-50' : 'border-titanium-900 text-titanium-300'
                    }`}
                  >
                    <span>{layer.name}</span>
                    <span className="font-mono text-[10px] uppercase text-titanium-500">{layer.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="mt-2 flex gap-1">
                <SovereignButton size="xs" variant="ghost" aria-label="Nach vorn" onClick={() => commit((current) => moveLayer(current, selected.id, 'forward'))}>↑</SovereignButton>
                <SovereignButton size="xs" variant="ghost" aria-label="Nach hinten" onClick={() => commit((current) => moveLayer(current, selected.id, 'back'))}>↓</SovereignButton>
                <SovereignButton size="xs" variant="danger" aria-label="Ebene löschen" onClick={() => {
                  commit((current) => removeLayer(current, selected.id));
                  setSelectedId(null);
                }}><Trash2 className="h-3 w-3" /></SovereignButton>
              </div>
            )}
          </div>
        </aside>

        <EditorCanvas
          ref={canvasRef}
          document={design}
          kit={kit}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChangeLayer={(id, next) => commit((current) => updateLayer(current, id, next))}
        />

        <aside className="flex flex-col gap-4 border-t border-titanium-900 p-3 lg:border-l lg:border-t-0">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">{kit.label}</p>
              {kit.logoIsDemo && <Badge variant="warning" size="sm">Demo-Logo</Badge>}
            </div>
            <p className="mb-2 text-xs text-titanium-400">
              {kit.source === 'demo'
                ? 'Kein Mandanten-Branding geladen. Farben sind die DesignOS-Standardtokens.'
                : 'Farben und Logo folgen dem Brand-Kit des Mandanten. Vorlagen speichern Token-Pfade.'}
            </p>
            <div className="flex gap-2">
              {BRAND_COLOR_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  title={token}
                  aria-label={token}
                  onClick={() => paint(token)}
                  className="h-8 w-8 border border-titanium-700"
                  style={{ background: resolveToken(kit, token) }}
                />
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-titanium-500">
              {format.width}×{format.height} · Safe-Zone nur Vorschau
            </p>
          </section>

          {selected?.kind === 'text' && (
            <TextFields
              layer={selected}
              onChange={(patch) => commit((current) => updateLayer(current, selected.id, patch))}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <SovereignButton size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>Vorlagen</SovereignButton>
            <SovereignButton size="sm" variant="outline" onClick={() => void openLibrary()}>Gespeichert</SovereignButton>
          </div>

          <section className="border border-dashed border-titanium-800 p-3" aria-label="Platzhalter">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">Nicht in diesem Schritt</p>
            <p className="mb-3 text-xs text-titanium-400">
              Es wird nichts erzeugt und nichts gesendet.
            </p>
            <div className="space-y-2">
              <Placeholder label="Bild erzeugen" note="KI-Generierung ist nicht angebunden." />
              <Placeholder label="Veröffentlichen" note="Ohne Kanalverbindung und Freigabe deaktiviert." />
              <Placeholder label="In den Plan" note="Redaktionskalender ist nicht Teil dieses Editors." />
            </div>
          </section>

          {status && (
            <p role="status" className="text-xs text-titanium-300">{status}</p>
          )}
        </aside>
      </div>

      <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Vorlagen" eyebrow="Design-DNA" size="md">
        <ul className="space-y-2">
          {SOCIAL_TEMPLATES.map((template) => (
            <li key={template.id} className="border border-titanium-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-titanium-100">{template.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                    {template.tone} · {template.formatId}
                  </p>
                </div>
                <SovereignButton size="sm" variant="primary" onClick={() => applyTemplate(template.id)}>Einsetzen</SovereignButton>
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Gespeicherte Designs" eyebrow="social_designs" size="md">
        {libraryError && <p className="mb-3 text-sm text-amber-300">{libraryError}</p>}
        {library.length === 0 && !libraryError && <p className="text-sm text-titanium-400">Noch nichts gespeichert.</p>}
        <ul className="space-y-2">
          {library.map((row) => (
            <li key={row.id}>
              <button type="button" className="w-full border border-titanium-800 px-3 py-2 text-left hover:border-titanium-600" onClick={() => loadSaved(row)}>
                <span className="block text-sm text-titanium-100">{row.title}</span>
                <span className="font-mono text-[10px] uppercase text-titanium-500">{row.format_id}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

function createInitial(): SocialDesignDocument {
  return documentFromTemplate('handwerk-ankuendigung');
}

function Placeholder({ label, note }: { label: string; note: string }) {
  return (
    <div>
      <SovereignButton size="sm" variant="ghost" disabled isFullWidth>
        {label}
        <Badge variant="warning" size="sm">Demo</Badge>
      </SovereignButton>
      <p className="mt-1 text-[11px] text-titanium-500">{note}</p>
    </div>
  );
}

function TextFields({
  layer,
  onChange,
}: {
  layer: Extract<DesignLayer, { kind: 'text' }>;
  onChange: (patch: Partial<DesignLayer>) => void;
}) {
  return (
    <div className="space-y-2">
      <Input
        label="Text"
        size="sm"
        value={layer.text}
        onChange={(event) => onChange({ text: event.target.value })}
      />
      <label className="block font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        Schrift-Token
        <select
          className="mt-1 w-full border border-titanium-800 bg-obsidian-950 px-2 py-1 text-xs text-titanium-100"
          value={layer.fontToken}
          onChange={(event) => onChange({ fontToken: event.target.value as typeof layer.fontToken })}
        >
          <option value="type.heading">type.heading</option>
          <option value="type.body">type.body</option>
        </select>
      </label>
    </div>
  );
}

export default SocialDesignEditor;
