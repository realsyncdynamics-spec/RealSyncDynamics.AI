import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Check, Globe, ShieldAlert } from 'lucide-react';
import { DESIGN_VARIANTS, hostFromUrl, variantById, type DesignVariant } from './design-variants';
import { PhotoSources } from './PhotoSources';
import { QuotePicker } from './QuotePicker';
import { AGENCY_COMPARE, firstInvoice, rungByKey, type RungKey } from './quote';
import type { SiteLook } from './site-look';
import { discoverSite } from './discover';
import { generateRebuildHtml, qualityGate, versionFrom } from './generate';
import { architecture, inferredFromHost } from './parse';
import type { QualityCheck, SiteDiscovery } from './types';
import { cn, formatEuro } from './uid';
import { savePending } from './pending';

type Stage = 'scan' | 'extract' | 'variants' | 'preview' | 'offer';

const STEPS = ['Crawler', 'Inhalt', 'Marke', 'Architektur', 'Fotografie', 'Rebuild'];

export function WowFunnel({ initialUrl = '' }: { initialUrl?: string }) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('scan');
  const [url, setUrl] = useState(initialUrl || '');
  const [step, setStep] = useState(0);
  const [model, setModel] = useState<SiteDiscovery | null>(null);
  const [picked, setPicked] = useState<DesignVariant | null>(null);
  const [html, setHtml] = useState('');
  const [versions, setVersions] = useState<{ id: string; note: string }[]>([]);
  const [company, setCompany] = useState('');
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [look, setLook] = useState<Partial<SiteLook>>({});
  const [rung, setRung] = useState<RungKey>('launch');

  const host = useMemo(() => hostFromUrl(url), [url]);
  const today = firstInvoice(rung);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!initialUrl.trim()) return;
    started.current = true;
    void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from the query string
  }, [initialUrl]);

  async function runScan() {
    if (!url.trim()) return;
    setStage('extract');
    setStep(0);
    const tick = window.setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 380);
    let next: SiteDiscovery;
    try {
      next = await discoverSite(url);
    } catch {
      next = inferredFromHost(url);
    }
    window.clearInterval(tick);
    setStep(STEPS.length - 1);
    setModel(next);
    setCompany(next.company);
    setChecks(qualityGate(next));
    setLook({
      photos: next.photos,
      hero: next.photos[0],
      headline: next.company,
      lead: next.description,
    });
    setStage('variants');
  }

  function choose(v: DesignVariant) {
    if (!model) return;
    const merged = { ...look, photos: look.photos?.length ? look.photos : model.photos };
    const page = generateRebuildHtml(model, v, merged);
    const ver = versionFrom(model, v, `Erstaufbau · ${v.name}`);
    setPicked(v);
    setLook(merged);
    setHtml(page);
    setVersions((list) => [{ id: ver.id, note: ver.note }, ...list].slice(0, 6));
    setStage('preview');
  }

  function applyLook(patch: Partial<SiteLook>) {
    if (!model) return;
    const next = { ...look, ...patch };
    const v = patch.variantId ? variantById(patch.variantId) : picked ?? DESIGN_VARIANTS[0];
    if (patch.variantId) setPicked(v);
    setLook(next);
    setHtml(generateRebuildHtml(model, v, next));
    if (!picked) {
      setPicked(v);
      setStage('preview');
    }
  }

  function goCheckout() {
    if (!model || !picked) return;
    savePending({
      company,
      domain: host,
      sourceUrl: model.url,
      knowledge: (model.services ?? []).map((s) => `${s.title}: ${s.description}`).join('\n'),
      extras: rungByKey(rung).extras,
      cents: today,
      setup: rung,
      abo: rungByKey(rung).abo,
      variant: picked.id,
    });
    navigate(`/builder/checkout?plan=${encodeURIComponent(rung)}&domain=${encodeURIComponent(host)}&variant=${encodeURIComponent(picked.id)}`);
  }

  return (
    <div className="relative isolate min-h-screen bg-[rgb(3,7,18)] text-white">
      {stage === 'scan' || stage === 'extract' ? (
        <img
          src="/landings/hero-minimal.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgb(3,7,18)]/70 via-[rgb(3,7,18)]/88 to-[rgb(3,7,18)]" />

      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Link to="/" className="text-sm font-semibold tracking-tight text-white">
          RealSync <span className="font-normal text-white/70">Dynamics.AI</span>
        </Link>
        <Link to="/welcome" className="text-sm text-white/55 hover:text-white">Login</Link>
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-10 md:px-8 md:pb-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-400">Photoreal Reconstruction</p>
        <h1
          className="mt-3 max-w-3xl text-4xl leading-[0.95] tracking-tight md:text-6xl"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
        >
          {stage === 'scan' && 'Ihre Domain. In 30 Sekunden die neue Seite.'}
          {stage === 'extract' && 'Licht, Material, Inhalt.'}
          {stage === 'variants' && `${model?.company} — drei fotografische Systeme.`}
          {stage === 'preview' && `${model?.company}`}
          {stage === 'offer' && 'Diese Seite auf Ihre Domain.'}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
          {stage === 'offer'
            ? `Sie haben sie gesehen. Agenturen verlangen ${AGENCY_COMPARE} — ohne dass Sie vorher scrollen.`
            : 'Fotorealistisch. Redaktionell. Nicht geklont. Rechtliches wird nicht erfunden. Der Preis kommt nach der Vorschau.'}
        </p>

        {stage === 'scan' ? (
          <form
            className="mt-10 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              void runScan();
            }}
          >
            <label htmlFor="url" className="block text-[11px] uppercase tracking-[.14em] text-white/40">
              Ihre bestehende Website
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="www.mein-unternehmen.de"
                className="h-12 flex-1 rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/50"
              />
              <button
                type="submit"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300"
              >
                Neue Seite zeigen
              </button>
            </div>
            <p className="mt-3 text-xs text-white/40">Kein Konto. Kein Preis vorher. Erst Ihre Vorschau.</p>
          </form>
        ) : null}

        {stage === 'extract' ? (
          <ol className="mt-10 max-w-md space-y-3">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-3 text-xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                <span className={cn('tabular-nums text-cyan-400', i > step && 'text-white/25')}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={i <= step ? 'text-white' : 'text-white/30'}>{label}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {stage === 'variants' && model ? (
          <div className="mt-10 space-y-6">
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Globe className="size-4 text-cyan-400" />
              <span className="text-white">{model.company}</span>
              {model.fetched ? ` · gelesen von ${model.host}` : ' · Quelle abgeleitet'}
              <span className="text-white/35"> · {architecture(model).map((p) => p.title).join(' · ')}</span>
            </p>
            <PhotoSources
              company={model.company}
              domainPhotos={model.photos}
              currentHero={look.hero}
              onApply={applyLook}
            />
            <div className="grid gap-3 md:grid-cols-3">
              {DESIGN_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => choose(v)}
                  className="group relative isolate min-h-[28rem] overflow-hidden rounded-2xl text-left"
                >
                  <img
                    src={look.hero || v.hero}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
                  <div className="relative flex h-full min-h-[28rem] flex-col justify-end p-5 text-[#f6f1e8]">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{v.name}</p>
                    <h2 className="mt-1 text-3xl leading-none" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                      {model.company}
                    </h2>
                    <p className="mt-2 text-sm text-white/75">{v.tagline}</p>
                    <span className="mt-4 inline-flex items-center text-sm font-medium">
                      So soll {model.company} aussehen <ArrowRight className="ml-1 size-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {stage === 'preview' && model && picked ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
            <iframe
              title="Rebuild"
              srcDoc={html}
              className="min-h-[48rem] w-full rounded-2xl bg-[rgb(3,7,18)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              sandbox="allow-same-origin allow-scripts"
            />
            <aside className="space-y-4">
              <div className="rounded-2xl border border-cyan-400/35 bg-cyan-400/10 p-4">
                <p className="font-mono text-[10px] uppercase tracking-wide text-cyan-300">Jetzt spüren</p>
                <p className="mt-2 text-2xl leading-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  Das ist {model.company} — nicht eine Demo.
                </p>
                <p className="mt-2 text-sm text-white/60">
                  Scrollen Sie links. Wenn Sie die Seite auf {host} wollen: {formatEuro(today)} heute, danach{' '}
                  {formatEuro(rungByKey(rung).abo === 'growth' ? 24900 : 7900)}/Monat.
                </p>
              </div>
              <PhotoSources
                company={model.company}
                domainPhotos={model.photos}
                currentHero={look.hero}
                onApply={applyLook}
              />
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Quality Gate</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {checks.map((c) => (
                    <li key={c.id} className="flex gap-2">
                      {c.ok ? (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-cyan-400" />
                      ) : (
                        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                      )}
                      <span>
                        <span className="text-white">{c.label}.</span>{' '}
                        <span className="text-white/50">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setStage('variants')}
                className="text-sm text-white/55 hover:text-white"
              >
                Andere Richtung
              </button>
              {versions.length ? (
                <p className="text-[11px] text-white/35">{versions.map((v) => v.note).join(' · ')}</p>
              ) : null}
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300"
                onClick={() => setStage('offer')}
              >
                Diese Website auf {host} setzen
                <ArrowRight className="size-3.5" />
              </button>
            </aside>
          </div>
        ) : null}

        {stage === 'offer' && picked && model ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <iframe
              title="Rebuild Freigabe"
              srcDoc={html}
              className="min-h-[36rem] w-full rounded-2xl bg-[rgb(3,7,18)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              sandbox="allow-same-origin allow-scripts"
            />
            <div className="rounded-2xl border border-cyan-400/35 bg-white/[.03] p-5">
              <p className="text-xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                {company || model.company} auf {host}
              </p>
              <p className="mt-2 text-sm text-white/55">
                Kein Konto vor der Vorschau. Jetzt Karte — dann Dashboard mit dieser Domain.
              </p>
              <div className="mt-4">
                <label htmlFor="co" className="block text-[11px] uppercase tracking-[.14em] text-white/40">
                  Unternehmen auf der Site
                </label>
                <input
                  id="co"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
                />
              </div>
              <div className="mt-5">
                <QuotePicker selected={rung} onChange={setRung} />
              </div>
              <button
                type="button"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300"
                onClick={goCheckout}
              >
                {rungByKey(rung).want} · {formatEuro(today)}
                <ArrowRight className="size-3.5" />
              </button>
              <p className="mt-3 text-[11px] text-white/40">
                {formatEuro(rungByKey(rung).cents)} einmalig + erster Monat. Danach nur das Abo. Kündbar.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
