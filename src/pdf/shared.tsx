import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

/**
 * Shared PDF building blocks for /dokumente-bundle.
 *
 * - DocMeta: Per-template input shape; each template adapts what it
 *   needs and ignores the rest. Keeps the form code single-shape.
 * - DOCS_VERSION: stamped into footers so users + auditors know which
 *   methodology / template revision they have.
 * - Shared StyleSheet, color palette + footer with disclaimer +
 *   generation-Timestamp.
 * - Optional Inter-font registration commented out (would require
 *   bundled .ttf-Asset; default Helvetica is fine for V1).
 */

export const DOCS_VERSION = '2026.05.0';

export interface DocMeta {
  /** Firmenname (Verantwortlicher / Auftraggeber). Pflicht. */
  company: string;
  /** Anschrift mehrzeilig: Straße + PLZ + Ort, optional Land. */
  address: string;
  /** Verantwortliche Kontakt-Email (z. B. datenschutz@firma.de). */
  contactEmail: string;
  /** Domain der Site, falls relevant für DSE. */
  domain?: string;
  /** Datenschutzbeauftragter — Name + Email — optional. */
  dpo?: { name: string; email: string };
  /** Hosting-Provider-Name, optional. */
  hostingProvider?: string;
  /** Generierungs-Datum als ISO-String. Wird im Footer formatiert. */
  generatedAt: string;
  /** Wird in der DSE optional genutzt — Tracker-Befunde aus Audit. */
  trackers?: string[];
}

// Falls custom-Fonts gewünscht: Font.register({ family: 'Inter', src: ... })
// Für V1 bleiben wir bei System-Default (Helvetica) — kompakter Bundle.
void Font;

export const COLORS = {
  ink:       '#1a1a1f',          // primary text
  ink2:      '#3a3a44',          // secondary text
  muted:     '#6a6a78',          // captions
  rule:      '#cccccc',          // hairline rules
  brass:     '#a07a2a',          // accent (RealSync gold)
  brassDark: '#7a5a18',
  panelBg:   '#f5f4f0',          // light info-box background
};

export const baseStyles = StyleSheet.create({
  page: {
    padding: '52pt 56pt 80pt 56pt',
    fontSize: 10.5,
    color: COLORS.ink,
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
  },
  h1: {
    fontSize: 22, fontWeight: 700, marginBottom: 4, color: COLORS.ink,
    letterSpacing: -0.4,
  },
  eyebrow: {
    fontSize: 8, color: COLORS.brass, letterSpacing: 1.6, textTransform: 'uppercase',
    marginBottom: 4, fontFamily: 'Helvetica-Bold',
  },
  lead: {
    fontSize: 11, color: COLORS.ink2, marginBottom: 18,
  },
  h2: {
    fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 6,
    color: COLORS.ink, fontFamily: 'Helvetica-Bold',
  },
  h3: {
    fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4,
    color: COLORS.ink2, fontFamily: 'Helvetica-Bold',
  },
  p: {
    fontSize: 10.5, marginBottom: 6, color: COLORS.ink2,
  },
  small: {
    fontSize: 9, color: COLORS.muted,
  },
  bullet: {
    flexDirection: 'row', marginBottom: 3,
  },
  bulletDot: {
    width: 12, fontSize: 10.5, color: COLORS.brass,
  },
  bulletText: {
    flex: 1, fontSize: 10.5, color: COLORS.ink2,
  },
  rule: {
    borderBottomWidth: 0.5, borderBottomColor: COLORS.rule, marginVertical: 10,
  },
  panel: {
    backgroundColor: COLORS.panelBg, padding: 10, marginVertical: 8,
    borderLeftWidth: 2, borderLeftColor: COLORS.brass,
  },
  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 18, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.rule,
  },
  brand: {
    fontSize: 9, color: COLORS.brass, letterSpacing: 1.5, fontFamily: 'Helvetica-Bold',
  },
  badge: {
    fontSize: 8, color: COLORS.muted, letterSpacing: 1.2,
  },
  /* Footer */
  footer: {
    position: 'absolute', bottom: 32, left: 56, right: 56,
    paddingTop: 8, borderTopWidth: 0.5, borderTopColor: COLORS.rule,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7.5, color: COLORS.muted, letterSpacing: 0.6,
  },
  footerCenter: {
    textAlign: 'center', fontSize: 7.5, color: COLORS.muted, letterSpacing: 0.6,
  },
  pageNum: {
    fontSize: 7.5, color: COLORS.muted,
  },
});

export function PdfHeader({ docTitle }: { docTitle: string }) {
  return (
    <View style={baseStyles.header} fixed>
      <Text style={baseStyles.brand}>RealSyncDynamics.AI</Text>
      <Text style={baseStyles.badge}>{docTitle.toUpperCase()}</Text>
    </View>
  );
}

export function PdfFooter({ meta }: { meta: DocMeta }) {
  const dt = new Date(meta.generatedAt);
  const dateStr = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
  return (
    <View style={baseStyles.footer} fixed>
      <Text>
        Generiert von RealSyncDynamics.AI · {dateStr} · Methodik {DOCS_VERSION}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`}
        style={baseStyles.pageNum}
      />
    </View>
  );
}

export function PdfDisclaimer() {
  return (
    <View style={baseStyles.panel}>
      <Text style={[baseStyles.small, { color: COLORS.ink2 }]}>
        Hinweis: Dieses Dokument wurde automatisch aus den von Ihnen
        eingegebenen Daten generiert und durch die Partnerkanzlei der
        RealSyncDynamics.AI methodisch geprüft. Es ersetzt keine
        individuelle Rechtsberatung.
      </Text>
    </View>
  );
}

export function PdfPage({ children }: { children: React.ReactNode }) {
  return <Page size="A4" style={baseStyles.page}>{children}</Page>;
}

export function Bullet({ children }: { children: string }) {
  return (
    <View style={baseStyles.bullet}>
      <Text style={baseStyles.bulletDot}>·</Text>
      <Text style={baseStyles.bulletText}>{children}</Text>
    </View>
  );
}
