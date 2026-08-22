import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { modulesForTrack, type ProductTrack } from '@/shared/pricing';
import {
  AVAILABLE_FRONTEND_ENTRY_MODES,
  FRONTEND_DELIVERY_LIMIT_NOTE,
  FRONTEND_INDIVIDUALITY_NOTE,
  PLANNED_FRONTEND_ENTRY_MODES,
} from '../../config/frontend-entry-modes';
import { withTrack, writeTrack } from '../productTrack';

/**
 * Die Weiche nach dem kostenlosen Scan.
 *
 * Bis hierher war der Trichter ein Website-Umbau-Trichter: Der Scan führte
 * direkt in die Gestaltungs-Vorschau, und wer nur Compliance wollte, hatte
 * keinen Ausgang. Das widerspricht dem Produktgrundsatz — Governance muss
 * unabhängig davon funktionieren, ob jemand sein Frontend anfassen will.
 *
 * Deshalb stehen die zwei Wege hier **gleichwertig** nebeneinander. Keiner
 * ist als „empfohlen" markiert, keiner ist optisch grösser, und die
 * Governance-Karte steht bewusst zuerst: Sie ist das Fundament, der Umbau
 * ist die Ergänzung. Wer das umdreht, drängt Kunden in den Builder zurück.
 */

interface TrackOption {
  track: ProductTrack;
  eyebrow: string;
  title: string;
  claim: string;
  bullets: string[];
  cta: string;
}

const OPTIONS: TrackOption[] = [
  {
    track: 'keep_frontend',
    eyebrow: 'Option A',
    title: 'Bestehende Website behalten',
    claim: 'Nutzen Sie RealSync ausschliesslich für Governance, Monitoring und Compliance.',
    bullets: [
      'Ihre Website bleibt unverändert — kein Umbau, keine Designänderung',
      'Anbindung über Scan, API, SDK oder Snippet',
      'Kontinuierliches Monitoring statt Einmalprüfung',
      'Chat, Terminbuchung und Voice bleiben zubuchbar',
    ],
    cta: 'Nur Governance — weiter zur Registrierung',
  },
  {
    track: 'modernize_frontend',
    eyebrow: 'Option B',
    title: 'Individuelles Frontend erstellen',
    claim: FRONTEND_INDIVIDUALITY_NOTE,
    // Die Aufzählung kommt aus der Fähigkeits-Quelle, nicht aus dieser Datei.
    // So kann hier nichts stehen, was die Runtime nicht ausführt.
    bullets: [
      ...AVAILABLE_FRONTEND_ENTRY_MODES.map((mode) => `${mode.name}: ${mode.pipeline}`),
      'Ihre bestehenden Inhalte bleiben erhalten — kein Neutexten',
      'Governance ist im gleichen Umfang enthalten',
    ],
    cta: 'Vorschau ansehen',
  },
];

export function PathChoicePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const domain = params.get('domain') ?? '';
  const rawScore = Number(params.get('score'));
  const scoreLabel = Number.isFinite(rawScore) && params.get('score') ? `${Math.round(rawScore)}%` : '—';
  const trackers = params.get('trackers');
  const cookies = params.get('cookies');

  // Die Zahl belegt die Aussage der Governance-Karte: Genau ein Modul
  // entfällt, wenn das Frontend bleibt — nicht das halbe Produkt.
  const keepFrontendModuleCount = useMemo(() => modulesForTrack('keep_frontend').length, []);

  const choose = (track: ProductTrack) => {
    writeTrack(track);
    const query = withTrack(params, track);
    navigate(track === 'keep_frontend' ? `/unified-entry/register?${query}` : `/unified-entry/preview?${query}`);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm font-medium text-petrol-500 uppercase tracking-wider">
          Scan abgeschlossen{domain ? ` · ${domain}` : ''}
        </p>
        <h1 className="text-4xl font-bold text-titanium-50">Was möchten Sie tun?</h1>
        <p className="text-xl text-titanium-300">
          Zwei getrennte Entscheidungen: Governance brauchen Sie in beiden Fällen — ob Sie Ihr
          Frontend anfassen, entscheiden Sie unabhängig davon.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-obsidian-900 border border-titanium-800 rounded-lg p-4">
          <p className="text-sm text-titanium-400">Governance Score</p>
          <p className="text-2xl font-bold text-petrol-500">{scoreLabel}</p>
        </div>
        <div className="bg-obsidian-900 border border-titanium-800 rounded-lg p-4">
          <p className="text-sm text-titanium-400">Tracker</p>
          <p className="text-2xl font-bold text-titanium-100">{trackers ?? '—'}</p>
        </div>
        <div className="bg-obsidian-900 border border-titanium-800 rounded-lg p-4">
          <p className="text-sm text-titanium-400">Cookies</p>
          <p className="text-2xl font-bold text-titanium-100">{cookies ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OPTIONS.map((option) => (
          <div
            key={option.track}
            className="bg-obsidian-800 border border-titanium-700 rounded-lg p-6 space-y-4 flex flex-col"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-petrol-500 uppercase tracking-wider">{option.eyebrow}</p>
              <h2 className="text-xl font-semibold text-titanium-50">{option.title}</h2>
              <p className="text-sm text-titanium-300">{option.claim}</p>
            </div>

            <ul className="space-y-2 flex-1">
              {option.bullets.map((bullet) => (
                <li key={bullet} className="text-sm text-titanium-400 flex gap-2">
                  <span className="text-petrol-500" aria-hidden="true">✓</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => choose(option.track)}
              className="px-6 py-3 bg-petrol-600 hover:bg-petrol-700 text-white font-medium rounded-lg transition-colors"
            >
              {option.cta}
            </button>
          </div>
        ))}
      </div>

      {PLANNED_FRONTEND_ENTRY_MODES.length > 0 && (
        <div className="bg-obsidian-900 border border-titanium-800 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-titanium-200">Noch nicht verfügbar</p>
          <ul className="space-y-1">
            {PLANNED_FRONTEND_ENTRY_MODES.map((mode) => (
              <li key={mode.id} className="text-sm text-titanium-500">
                <span className="text-titanium-400">{mode.name}</span> — {mode.unavailableReason}
              </li>
            ))}
          </ul>
          <p className="text-sm text-titanium-500">{FRONTEND_DELIVERY_LIMIT_NOTE}</p>
        </div>
      )}

      <p className="text-sm text-titanium-500 border-t border-titanium-800 pt-6">
        Beide Wege führen zur Registrierung und zum selben Governance-Umfang. Ohne Frontend-Umbau
        stehen {keepFrontendModuleCount} der {modulesForTrack('modernize_frontend').length} buchbaren
        Module zur Verfügung — es entfällt allein das AI Frontend. Der Weg lässt sich später jederzeit
        wechseln.
      </p>
    </div>
  );
}
