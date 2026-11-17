import type { Plan } from '@/shared/pricing';

/** Zelle der Pakettabelle: Text oder enthalten/nicht enthalten. */
export type PlanCell = string | boolean;

export interface PlanRow {
  label: string;
  /** Wert ausschließlich aus `shared/pricing.ts` bzw. der Status-Registry ableiten. */
  value: (plan: Plan) => PlanCell;
}

export interface LandingCard {
  title: string;
  text: string;
  /** Registry-ID aus `src/product/implementation-status.ts`; ergibt das Status-Label. */
  statusId?: string;
  /** Interner Pfad einer vorhandenen Route; macht die Karte zum Link. */
  to?: string;
  /** Linktext der Karte, Pflicht zusammen mit `to`. */
  toLabel?: string;
}

export interface LandingSection {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  kind: 'cards' | 'steps' | 'list';
  cards?: LandingCard[];
  list?: string[];
}

export interface LandingCta {
  label: string;
  /** Interner Pfad einer vorhandenen Route aus `src/App.tsx`. */
  to: string;
}

export interface ProductLandingContent {
  slug: 'app-builder' | 'ki-bots' | 'optimizer' | 'governance-os' | 'browser-agent';
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  /** Registry-ID für das Status-Label im Kopf. Ohne Eintrag: kein Label. */
  statusId?: string;
  headline: string;
  headlineSub: string;
  lead: string;
  primaryCta: LandingCta;
  secondaryCta: LandingCta;
  hint: string;
  example: { title: string; rows: string[]; caption: string };
  sections: LandingSection[];
  planIntro: string;
  planRows: PlanRow[];
  faq: { question: string; answer: string }[];
  closing: { title: string; text: string };
}
