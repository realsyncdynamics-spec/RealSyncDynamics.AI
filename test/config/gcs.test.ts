import { describe, it, expect } from 'vitest';
import {
  GCS_DIMENSIONS,
  GCS_PACKAGES,
  GCS_MAX_RAW,
  computeGcs,
  levelForScore,
  gcsPackageById,
  type GcsAnswers,
} from '../../src/config/gcs';
import { SELLABLE_PRICING_TIERS, tierById } from '../../src/config/pricing';

describe('GCS-Modell (Governance Complexity Score)', () => {
  it('GCS_MAX_RAW entspricht der Summe der Dimensions-Maxima', () => {
    const sum = GCS_DIMENSIONS.reduce((s, d) => s + d.max, 0);
    expect(GCS_MAX_RAW).toBe(sum);
  });

  it('jede Dimensions-Option hat ein Gewicht ≤ Dimensions-Max', () => {
    for (const dim of GCS_DIMENSIONS) {
      for (const opt of dim.options) {
        expect(opt.weight).toBeLessThanOrEqual(dim.max);
        expect(opt.weight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('die Pakete decken lückenlos 0–100 ab', () => {
    const scored = [...GCS_PACKAGES].sort((a, b) => a.minScore - b.minScore);
    expect(scored[0].minScore).toBe(0);
    expect(scored[scored.length - 1].maxScore).toBe(100);
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i].minScore).toBe(scored[i - 1].maxScore + 1);
    }
  });

  it('jedes Paket mappt auf einen bestehenden Pricing-Tier (Checkout bleibt intakt)', () => {
    const tierIds = GCS_PACKAGES.map((p) => p.tierId);
    expect(tierIds).toEqual(['starter', 'growth', 'enterprise']);
  });

  // Der eigentliche Befund vom 2026-09-06: Das obere Band zeigte auf `agency`
  // — einen seit AP2 stillgelegten Plan. Wer dort landete, wurde auf einen
  // Checkout geschickt, den es nicht mehr gibt. Diese beiden Prüfungen halten
  // das fest, damit ein künftiger Plan-Umbau die Sackgasse nicht wieder öffnet.
  it('kein Paket empfiehlt einen stillgelegten Plan', () => {
    const angeboten = new Set(SELLABLE_PRICING_TIERS.map((t) => t.id as string));
    for (const paket of GCS_PACKAGES) {
      expect(angeboten, `${paket.id} → ${paket.tierId}`).toContain(paket.tierId as string);
    }
  });

  // Das obere Band zeigt seither auf einen Vertragsplan. Dessen Betrag steht
  // in der SSoT, ist aber nicht öffentlich zugesichert — die Fläche muss ihn
  // deshalb als „Auf Anfrage" zeigen und nicht als Preis.
  it('das obere Band führt auf einen Plan, dessen Betrag auf Anfrage gilt', () => {
    const oben = GCS_PACKAGES.find((p) => p.maxScore === 100 && p.minScore > 0)!;
    expect(tierById(oben.tierId)?.priceOnRequest).toBe(true);
  });

  it('kein Paket trägt einen Namen, den es als Plan nicht gibt', () => {
    // „Professional" war so ein Name: nirgends buchbar, nirgends auffindbar.
    const namen = GCS_PACKAGES.map((p) => p.name);
    expect(namen).not.toContain('Professional');
  });

  it('levelForScore klassifiziert die Bänder korrekt', () => {
    expect(levelForScore(0)).toBe('low');
    expect(levelForScore(30)).toBe('low');
    expect(levelForScore(31)).toBe('moderate');
    expect(levelForScore(55)).toBe('moderate');
    expect(levelForScore(56)).toBe('elevated');
    expect(levelForScore(80)).toBe('elevated');
    expect(levelForScore(81)).toBe('high');
    expect(levelForScore(100)).toBe('high');
  });

  it('leere Antworten ergeben Score 0 und empfehlen Starter', () => {
    const res = computeGcs({});
    expect(res.score).toBe(0);
    expect(res.recommended.id).toBe('starter');
  });

  // ─── Persona-Fixtures (aus der Produktvision) ──────────────────────

  const FRISEUR: GcsAnswers = {
    industry: 'local_services',
    sensitiveData: 'none',
    aiUsage: 'none',
    employees: 'micro',
    thirdParties: 'few',
    tracking: 'basic',
    documentation: 'minimal',
    internationalTransfers: 'none',
  };

  const HANDWERKER: GcsAnswers = {
    industry: 'local_services',
    sensitiveData: 'personal',
    aiUsage: 'none',
    employees: 'small',
    thirdParties: 'some',
    tracking: 'analytics',
    documentation: 'standard',
    internationalTransfers: 'us',
  };

  const ARZTPRAXIS: GcsAnswers = {
    industry: 'health',
    sensitiveData: 'special',
    aiUsage: 'high_risk',
    employees: 'small',
    thirdParties: 'some',
    tracking: 'basic',
    documentation: 'extended',
    internationalTransfers: 'none',
  };

  const KANZLEI: GcsAnswers = {
    industry: 'legal',
    sensitiveData: 'special',
    aiUsage: 'customer',
    employees: 'small',
    thirdParties: 'many',
    tracking: 'basic',
    documentation: 'extended',
    internationalTransfers: 'us',
  };

  it('Friseur → niedriger Score → Starter', () => {
    const res = computeGcs(FRISEUR);
    expect(res.level).toBe('low');
    expect(res.recommended.id).toBe('starter');
  });

  it('Handwerker → mittlerer Score → Business', () => {
    const res = computeGcs(HANDWERKER);
    expect(res.level).toBe('moderate');
    expect(res.recommended.id).toBe('business');
  });

  it('Arztpraxis → hohe Komplexität → Enterprise', () => {
    const res = computeGcs(ARZTPRAXIS);
    expect(res.score).toBeGreaterThanOrEqual(56);
    expect(res.recommended.id).toBe('enterprise');
    // Gesundheitsdaten + KI in sensiblem Prozess müssen als Risiken auftauchen.
    const dims = res.risks.map((r) => r.dimension);
    expect(dims).toContain('sensitiveData');
    expect(dims).toContain('aiUsage');
  });

  it('Kanzlei → hohe Komplexität → Enterprise', () => {
    const res = computeGcs(KANZLEI);
    expect(res.score).toBeGreaterThanOrEqual(56);
    expect(res.recommended.id).toBe('enterprise');
  });

  it('Score steigt monoton mit der Komplexität (Friseur < Handwerker < Arztpraxis)', () => {
    const f = computeGcs(FRISEUR).score;
    const h = computeGcs(HANDWERKER).score;
    const a = computeGcs(ARZTPRAXIS).score;
    expect(f).toBeLessThan(h);
    expect(h).toBeLessThan(a);
  });

  it('Multi-Mandant-Bedarf empfiehlt Enterprise unabhängig vom Score', () => {
    const res = computeGcs(FRISEUR, { multiTenant: true });
    expect(res.recommended.id).toBe('enterprise');
  });

  it('über 250 Mitarbeitende ist ein Enterprise-Signal', () => {
    const res = computeGcs({ ...HANDWERKER, employees: 'large' });
    expect(res.recommended.id).toBe('enterprise');
  });

  it('gcsPackageById liefert das passende Paket', () => {
    expect(gcsPackageById('business').tierId).toBe('growth');
    expect(gcsPackageById('enterprise').tierId).toBe('enterprise');
  });
});
