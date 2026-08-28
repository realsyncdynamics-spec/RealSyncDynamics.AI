import { useMemo, useState } from 'react';
import {
  FURNITURE_CHECKLIST,
  type ChannelState,
  type OnboardingProfile,
  art50Required,
} from '@/shared/onboarding';
import { ART50_SENTENCE_DE } from '@/shared/onboarding-copy.de';
import {
  OPERATE_CHANNELS,
  applyChannelTransition,
  evidencePayloadForChannel,
  type OperateChannelId,
} from '@/shared/channel-gate';
import { writeChecklistFlags, writeOnboardingProfile } from './onboardingStorage';

const STATE_LABEL: Record<ChannelState, string> = {
  off: 'Aus',
  test: 'Test',
  live: 'Live',
};

function emitEvidence(detail: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rsd-evidence', { detail }));
}

export function ChannelToggles({
  profile,
  onProfileChange,
}: {
  profile: OnboardingProfile;
  onProfileChange?: (next: OnboardingProfile) => void;
}) {
  const items =
    profile.vertical === 'furniture'
      ? [...FURNITURE_CHECKLIST]
      : ['Art.-50-Text sichtbar', 'Handoff-Kontakt hinterlegt', 'Grenzen im Bot hinterlegt'];

  const [checks, setChecks] = useState<boolean[]>(() => items.map(() => false));
  const [blocked, setBlocked] = useState<string | null>(null);

  const checklistDone = checks.filter(Boolean).length;
  const art50Visible = profile.vertical === 'furniture' ? checks[3] === true : checks[0] === true;

  const liveReady = useMemo(
    () =>
      applyChannelTransition({
        to: 'live',
        jobs: profile.jobs,
        checklistDone,
        checklistTotal: items.length,
        art50Visible,
      }).ok,
    [art50Visible, checklistDone, items.length, profile.jobs],
  );

  function setChannel(id: OperateChannelId, to: ChannelState) {
    const from = profile.channels[id];
    const result = applyChannelTransition({
      to,
      jobs: profile.jobs,
      checklistDone,
      checklistTotal: items.length,
      art50Visible,
    });
    const accepted = result.ok && result.state === to;
    emitEvidence(
      evidencePayloadForChannel({
        channel: id,
        from,
        to,
        accepted,
        reason: result.ok ? undefined : result.reason,
      }),
    );
    if (!result.ok) {
      setBlocked(
        'Live bleibt gesperrt, bis Checkliste und Art. 50 erfüllt sind. Kanal bleibt auf Test.',
      );
      return;
    }
    setBlocked(null);
    const next: OnboardingProfile = {
      ...profile,
      channels: { ...profile.channels, [id]: result.state },
    };
    writeOnboardingProfile(next);
    onProfileChange?.(next);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6" data-testid="channel-toggles">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">OPERATE</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">Kanäle · Aus / Test / Live</h2>
      <p className="mt-2 text-sm text-slate-600">
        Live ist fail-closed. Der Schalter ändert nichts an Preisen — nur am Betriebszustand.
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((item, index) => (
          <li key={item}>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={checks[index]}
                onChange={() => {
                  const next = checks.map((value, i) => (i === index ? !value : value));
                  setChecks(next);
                  writeChecklistFlags(next);
                }}
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>

      {art50Required(profile.jobs) && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {ART50_SENTENCE_DE}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {OPERATE_CHANNELS.map((channel) => {
          const state = profile.channels[channel.id];
          return (
            <div
              key={channel.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
              data-testid={`channel-row-${channel.id}`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{channel.label}</p>
                <p className="text-xs text-slate-500">Zustand: {STATE_LABEL[state]}</p>
              </div>
              <div className="flex gap-1">
                {(['off', 'test', 'live'] as const).map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    disabled={candidate === 'live' && !liveReady}
                    onClick={() => setChannel(channel.id, candidate)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      state === candidate
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 text-slate-600'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {STATE_LABEL[candidate]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {blocked && (
        <p className="mt-3 text-sm text-rose-700" data-testid="channel-live-blocked">
          {blocked}
        </p>
      )}
    </section>
  );
}
