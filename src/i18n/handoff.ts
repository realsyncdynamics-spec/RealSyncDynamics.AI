/**
 * Governance OS Handoff v2 — UI-Copy DE/EN.
 *
 * `HANDOFF_COPY` ist `i18n.json` aus dem Claude-Design-Handoff (104 Strings,
 * Schlüssel = `T.de` / `T.en` im Prototyp), unverändert übernommen. DE ist
 * Vorgabe.
 *
 * `HANDOFF_OVERRIDES` korrigiert Strings, die gegen den Produktstand eine
 * falsche Zusage machen würden — jede Abweichung ist begründet:
 *
 *   loginSub   „kein Drittanbieter" widerspricht den angebotenen OAuth-Logins
 *              (Google u. a., siehe OAuthProviderButtons).
 *   loginNote  „Keine Weitergabe in Drittländer" ist mit OAuth-Anbietern und
 *              Cloudflare-Analytics nicht haltbar; belegt ist nur die
 *              Supabase-Region eu-central-1 (Frankfurt).
 *   auditFoot  `gdpr-audit` speichert Domain und E-Mail für Bericht und
 *              Report-Mail (Tabelle `gdpr_audits`). „Keine Speicherung ohne
 *              Einwilligung" wäre falsch.
 *   pricingSub „Preise netto" passt nicht zur Kleinunternehmer-Regel
 *              (§ 19 UStG, `COMPANY.taxMode`), „alle Daten in der EU" ist
 *              breiter als belegt; übrig bleibt, was stimmt.
 *   pricingFoot  wird nur angezeigt, wenn `COMPANY.taxMode === 'EXEMPT'`.
 *   heroA–C, sub1, sub2  Positionierung nach Entscheidung E-F3 (2026-09-27):
 *              „Die Kontrollschicht für KI im Unternehmen." Kategorie bleibt
 *              Governance, nicht EU-AI-Act-Software; Compliance ist
 *              Proof-Layer unter der Control-Plane-These. `heroA` ist die erste
 *              Zeile, `heroB` + `heroC` (Akzent) die zweite — zusammen genau
 *              der beschlossene Satz.
 *   cta        Der Header-CTA führt weiter in die Governance-Pipeline
 *              (`#pipeline`). Der Primär-CTA im Hero führt in den Scan
 *              (`PUBLIC_CTA.to` = `/audit`) und trägt sein eigenes Label aus
 *              `hero-content.ts` (`HERO_FREE_SCAN_CTA_LABEL`).
 *
 * `HANDOFF_EXTRA` enthält Strings, die im Prototyp als Literal standen
 * (Navigation, Badge, Loop, Formularlabels) — ebenfalls DE/EN.
 */

import { HANDOFF_APP, type HandoffAppKey } from './handoffApp';

export type Lang = 'de' | 'en';

export const LANGS: readonly Lang[] = ['de', 'en'] as const;

export const HANDOFF_COPY = {
  de: {
    navProduct: "Produkt",
    navPricing: "Preise",
    cta: "Governance-Scan starten",
    cta2: "Live Dashboard ansehen",
    heroA: "Europa braucht kein weiteres Frontier-Modell.",
    heroB: "Europa braucht Kontrolle über",
    heroC: "Frontier-KI.",
    sub1: "RealSyncDynamics.AI ist die Control Plane für Enterprise-KI.",
    sub2: "Wir bauen nicht die Intelligenz selbst. Wir bauen die Kontroll-, Autorisierungs- und Evidenzschicht zwischen Unternehmen und KI.",
    loginTitle: "Anmelden",
    loginSub: "Magic Link per E-Mail — kein Passwort, kein Drittanbieter.",
    loginBtn: "Magic Link senden",
    loginNote: "Auth über Supabase EU (Frankfurt). Keine Weitergabe in Drittländer.",
    linkSent: "Link gesendet",
    openDash: "Dashboard öffnen",
    loginQuote: "Jede Governance-Entscheidung wird zur Laufzeit getroffen — und in der Evidence Chain festgehalten.",
    auditTitle: "Ihr KI-Bestand in vier Fragen.",
    auditFoot: "Ergebnis ohne Account. Keine Speicherung der Domain ohne Ihre Einwilligung.",
    q0: "Wen prüfen wir?",
    q0hint: "Unternehmen und Hauptdomain.",
    q1: "Was muss nachweisbar sein?",
    q1hint: "DSGVO und EU AI Act sitzen im Fundament.",
    q2: "Welche KI-Systeme sind im Einsatz?",
    q2hint: "Die Durchsetzbarkeits-Klasse zeigt, was technisch anhaltbar ist.",
    q3: "Wer nutzt das Produkt?",
    q3hint: "Die Rolle bestimmt den Plan stärker als der Score.",
    running: "Audit läuft",
    resultTitle: "Ihre drei kritischen Risiken",
    recPlan: "Empfohlener Plan",
    back: "Zurück",
    next: "Weiter",
    start: "Audit starten",
    toDash: "Dashboard öffnen",
    pricingTitle: "Vom kostenlosen Audit bis zur Agentur-Suite.",
    pricingSub: "Monatlich kündbar. Preise netto. Alle Daten in der EU verarbeitet und gespeichert.",
    monthly: "Monatlich",
    yearly: "Jährlich",
    popular: "Beliebt",
    pricingFoot: "Hinweis: Rechnungsstellung ohne Ausweis von Umsatzsteuer gemäß § 19 UStG (Kleinunternehmer). Enterprise auf Anfrage.",
    navOverview: "Übersicht",
    navSystems: "KI-Systeme",
    navClassify: "Klassifizierung",
    navEnforce: "Enforcement",
    navEvidence: "Evidence",
    navVoice: "Voice",
    navReports: "Berichte",
    navBilling: "Abrechnung",
    more: "Mehr",
    planNote: "Evidence Vault read-only. Policies ab Starter durchsetzbar.",
    upgrade: "Plan wechseln",
    complianceScore: "Compliance Score",
    enforceClasses: "Durchsetzbarkeits-Klassen",
    lastEvidence: "Letzte Evidenz",
    all: "Alle",
    attention: "Braucht Aufmerksamkeit",
    inventory: "Inventar",
    type: "Typ",
    enfClass: "Klasse",
    riskTier: "Risikostufe",
    toEnforce: "Zu Enforcement",
    transparency: "Transparenz",
    art50Note: "Nutzer müssen erkennen, dass sie mit einem KI-System interagieren.",
    obligations: "Pflichten",
    time: "Zeit",
    entries: "Einträge",
    exportBundle: "Audit-Bundle exportieren",
    verifyBtn: "Kette verifizieren",
    verify: "Prüfen",
    enforceFoot: "Die Klasse wird abgeleitet, nie eingegeben. Ein Verdikt, das die Klasse technisch nicht hergibt, wird nicht versprochen (Art. 13, Art. 14 EU AI Act · Art. 5 Abs. 2 DSGVO).",
    kSystems: "KI-Systeme",
    kSystemsSub: "{n} unklassifiziert",
    kHigh: "Hochrisiko",
    kHighSub: "Annex III",
    kPolicies: "Policies aktiv",
    kPoliciesSub: "{n} nur beobachtend",
    kEvidence: "Evidenz-Einträge",
    kEvidenceSub: "Kette intakt",
    ovDashboard: "Übersicht",
    ovDashboardSub: "Command Center",
    ovDiscover: "KI-Systeme",
    ovDiscoverSub: "Discover · Inventar",
    ovClassify: "Klassifizierung",
    ovClassifySub: "Classify · EU AI Act",
    ovEnforce: "Enforcement",
    ovEnforceSub: "Enforce · Policy Decision Point",
    ovEvidence: "Evidence Chain",
    ovEvidenceSub: "Prove · append-only",
    ovReports: "Berichte",
    ovReportsSub: "Export je Rahmenwerk",
    statPolicies: "Policies",
    statBlocking: "Anhaltend",
    statObserving: "Nachgelagert",
    statPaper: "Nur Papier",
    verIdle: "Kette nicht geprüft",
    verIdleSub: "Letzte Prüfung: —",
    verRun: "Verifiziere …",
    verRunSub: "SHA-256 rekonstruieren",
    verOk: "Kette intakt",
    verOkSub: "{n} Einträge · Ed25519 gültig",
    genBtn: "Erzeugen",
    genRun: "Wird erzeugt …",
    genReady: "Neu erzeugen",
    stDraft: "Entwurf",
    stReady: "Bereit",
    stRun: "Läuft",
  },
  en: {
    navProduct: "Product",
    navPricing: "Pricing",
    cta: "Start governance scan",
    cta2: "View live dashboard",
    heroA: "The Governance OS",
    heroB: "for Autonomous",
    heroC: "AI",
    sub1: "RealSyncDynamics.AI is the control plane for enterprise AI.",
    sub2: "Any model. Any agent. One control plane.",
    loginTitle: "Sign in",
    loginSub: "Magic link by e-mail — no password, no third party.",
    loginBtn: "Send magic link",
    loginNote: "Auth via Supabase EU (Frankfurt). No third-country transfer.",
    linkSent: "Link sent",
    openDash: "Open dashboard",
    loginQuote: "Every governance decision is made at runtime — and recorded in the evidence chain.",
    auditTitle: "Your AI inventory in four questions.",
    auditFoot: "Result without an account. Domain is not stored without consent.",
    q0: "Who are we auditing?",
    q0hint: "Company and primary domain.",
    q1: "What must be provable?",
    q1hint: "GDPR and the EU AI Act sit in the foundation.",
    q2: "Which AI systems are in use?",
    q2hint: "The enforcement class shows what can technically be stopped.",
    q3: "Who uses the product?",
    q3hint: "Role drives the plan more than the score.",
    running: "Audit running",
    resultTitle: "Your three critical risks",
    recPlan: "Recommended plan",
    back: "Back",
    next: "Next",
    start: "Run audit",
    toDash: "Open dashboard",
    pricingTitle: "From free audit to agency suite.",
    pricingSub: "Cancel monthly. Prices net. All data processed and stored in the EU.",
    monthly: "Monthly",
    yearly: "Yearly",
    popular: "Popular",
    pricingFoot: "Note: invoices issued without VAT under § 19 UStG (small business). Enterprise on request.",
    navOverview: "Overview",
    navSystems: "AI systems",
    navClassify: "Classification",
    navEnforce: "Enforcement",
    navEvidence: "Evidence",
    navVoice: "Voice",
    navReports: "Reports",
    navBilling: "Billing",
    more: "More",
    planNote: "Evidence vault read-only. Policies enforceable from Starter.",
    upgrade: "Change plan",
    complianceScore: "Compliance score",
    enforceClasses: "Enforcement classes",
    lastEvidence: "Latest evidence",
    all: "All",
    attention: "Needs attention",
    inventory: "Inventory",
    type: "Type",
    enfClass: "Class",
    riskTier: "Risk tier",
    toEnforce: "To enforcement",
    transparency: "Transparency",
    art50Note: "Users must be able to tell they interact with an AI system.",
    obligations: "Obligations",
    time: "Time",
    entries: "Entries",
    exportBundle: "Export audit bundle",
    verifyBtn: "Verify chain",
    verify: "Verify",
    enforceFoot: "The class is derived, never entered. A verdict the class cannot technically deliver is never promised (Art. 13, Art. 14 EU AI Act · Art. 5(2) GDPR).",
    kSystems: "AI systems",
    kSystemsSub: "{n} unclassified",
    kHigh: "High risk",
    kHighSub: "Annex III",
    kPolicies: "Policies active",
    kPoliciesSub: "{n} observe only",
    kEvidence: "Evidence entries",
    kEvidenceSub: "Chain intact",
    ovDashboard: "Overview",
    ovDashboardSub: "Command center",
    ovDiscover: "AI systems",
    ovDiscoverSub: "Discover · inventory",
    ovClassify: "Classification",
    ovClassifySub: "Classify · EU AI Act",
    ovEnforce: "Enforcement",
    ovEnforceSub: "Enforce · policy decision point",
    ovEvidence: "Evidence chain",
    ovEvidenceSub: "Prove · append-only",
    ovReports: "Reports",
    ovReportsSub: "Export per framework",
    statPolicies: "Policies",
    statBlocking: "Blocking",
    statObserving: "Downstream",
    statPaper: "Paper only",
    verIdle: "Chain not verified",
    verIdleSub: "Last check: —",
    verRun: "Verifying …",
    verRunSub: "Rebuilding SHA-256",
    verOk: "Chain intact",
    verOkSub: "{n} entries · Ed25519 valid",
    genBtn: "Generate",
    genRun: "Generating …",
    genReady: "Regenerate",
    stDraft: "Draft",
    stReady: "Ready",
    stRun: "Running",
  },
} as const;

type CopyKey = keyof (typeof HANDOFF_COPY)['de'];

export const HANDOFF_OVERRIDES: Record<Lang, Partial<Record<CopyKey, string>>> = {
  de: {
    loginSub: 'Magic Link per E-Mail — kein Passwort.',
    loginNote: 'Auth über Supabase EU (Frankfurt).',
    auditFoot:
      'Ergebnis ohne Account. Domain und E-Mail werden für den Bericht gespeichert — Details in der Datenschutzerklärung.',
    pricingSub: 'Monatlich kündbar. Datenhaltung in der EU (Supabase Frankfurt).',
    cta: 'Governance-Scan starten',
    heroA: 'Die Kontrollschicht',
    heroB: 'für KI im',
    heroC: 'Unternehmen.',
    sub1: 'RealSyncDynamics.AI macht sichtbar, welche KI-Systeme, Bots und Agenten im Einsatz sind,',
    sub2: 'welche Daten sie nutzen, welche Regeln gelten und welche Nachweise entstehen.',
  },
  en: {
    loginSub: 'Magic link by e-mail — no password.',
    loginNote: 'Auth via Supabase EU (Frankfurt).',
    auditFoot:
      'Result without an account. Domain and e-mail are stored for the report — see the privacy policy.',
    pricingSub: 'Cancel monthly. Data stored in the EU (Supabase Frankfurt).',
    cta: 'Start governance scan',
    heroA: 'The control layer',
    heroB: 'for AI in the',
    heroC: 'enterprise.',
    sub1: 'RealSyncDynamics.AI shows which AI systems, bots and agents are in use,',
    sub2: 'which data they use, which rules apply and which evidence is produced.',
  },
};

export const HANDOFF_EXTRA = {
  de: {
    brandName: 'RealSync Dynamics',
    navLogin: 'Login',
    langSwitch: 'Sprache wechseln',
    menuOpen: 'Navigation öffnen',
    menuClose: 'Navigation schließen',
    mainNav: 'Hauptnavigation',
    // Claim-Audit WP1: „für autonome KI" versprach eine Agenten-Autonomie, die
    // laut implementation-status.ts Preview/Coming-Soon ist. Belegt ist die
    // Kontroll- und Nachweisschicht.
    heroEyebrow: 'REALSYNCDYNAMICS.AI / KONTROLL- UND NACHWEISSCHICHT FÜR KI',
    ctaExplore: 'Architektur ansehen',
    ctaEnterprise: 'Enterprise anfragen',
    loopExecute: 'EXECUTE',
    loopVerify: 'VERIFY',
    loopDiscover: 'DISCOVER',
    loopAssess: 'ASSESS',
    loopGovern: 'GOVERN',
    loopProve: 'PROVE',
    trustLine: 'Any model · Any agent · One control plane · Evidence als Proof-Layer',
    heroActions: 'Hero-Aktionen',
    backHome: 'Zur Startseite',
    emailLabel: 'E-Mail',
    emailPlaceholder: 'vorname.name@firma.de',
    sending: 'Wird gesendet …',
    linkSentBody: 'Öffnen Sie den Link in der E-Mail auf diesem Gerät — danach geht es automatisch weiter.',
    resend: 'E-Mail-Adresse korrigieren und erneut senden',
    orOauth: 'oder mit einem Konto anmelden',
    trustRuntime: 'Trust · Runtime',
    trustMono: 'Supabase EU (Frankfurt) · Magic Link · Ed25519 · SHA-256 Hash-Chain',
    resumeHint: 'Nach der Anmeldung geht es direkt weiter.',
    authNotConfigured: 'Auth ist nicht konfiguriert (VITE_SUPABASE_URL fehlt).',
    sendFailed: 'Magic Link konnte nicht gesendet werden.',
    loginAborted: 'Login abgebrochen',
    auditOverline: 'Free Audit · 0 €',
    stepCompany: 'Unternehmen',
    stepFrameworks: 'Rahmenwerke',
    stepSystems: 'KI-Systeme',
    stepRole: 'Rolle',
    stepResult: 'Ergebnis',
    companyLabel: 'Unternehmen',
    companyPlaceholder: 'Muster GmbH',
    domainLabel: 'Hauptdomain',
    domainPlaceholder: 'muster.de',
    reportEmailLabel: 'E-Mail für den Bericht',
    reportEmailHint: 'Der Scan braucht eine geschäftliche E-Mail für die Berichtszustellung.',
    followUpConsentLabel:
      'Ich möchte gelegentlich Follow-up-E-Mails mit Angeboten und Informationen zu Audit-Ergebnissen erhalten. Abmelden jederzeit möglich. (optional)',
    followUpConsentPrivacy: 'Datenschutzerklärung',
    comingSoon: 'Coming Soon',
    roleSelf: 'Ich selbst',
    roleTeam: 'Team bis fünf',
    roleAgency: 'Agentur',
    roleEnterprise: 'Konzern · SSO',
    runStart: 'Domain wird normalisiert',
    runRequest: 'Scan-Anfrage an gdpr-audit gesendet',
    runWaiting: 'Warte auf das Scan-Ergebnis …',
    runDone: 'Ergebnis erhalten',
    runFailed: 'Scan fehlgeschlagen',
    scoreLabel: 'Compliance Score aus dem Domain-Scan',
    scoreSource: 'Quelle: gdpr-audit · {domain}',
    noCriticalRisks: 'Der Scan hat keine kritischen oder hohen Befunde gemeldet.',
    recWhy: 'Abgeleitet aus Rolle, Rahmenwerken und KI-Systemen — nicht aus dem Score.',
    toPlan: 'Plan ansehen',
    fullReport: 'Vollständiger Bericht',
    retry: 'Neuer Scan',
    highRisk: 'Hochrisiko · Annex III',
    classPrefix: 'Klasse',
    popularBadge: 'Beliebt',
    selected: 'Ausgewählt',
    yearlyComingSoon: 'Jährlich · Coming Soon',
    yearlyNote: 'Jahresabrechnung ist noch nicht buchbar — Buchung aktuell monatlich.',
    bookMonthly: 'Monatlich buchen',
    perMonth: '/ Monat',
    perYear: '/ Jahr',
    onRequest: 'Auf Anfrage',
    once: 'einmalig · kein Account',
    billingToggle: 'Abrechnungszeitraum',
    moreInfo: 'Mehr erfahren',
    trialNote: '{days} Tage kostenlos testen',
    residencyLabel: 'Wo sollen KI-Daten verarbeitet werden? (optional)',
    residencyLocal: 'Lokal im Haus',
    residencyEu: 'EU-Cloud',
    residencyHybrid: 'Gemischt / offen',
    // /pricing Fusszeile + Disclaimer (keine Steuertexte — die bleiben SSoT).
    pricingTrustNote:
      'Free Audit kostenlos · 14 Tage kostenlos testen · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany',
    pricingTrialFoot:
      'Free Audit kostenlos · kein Account nötig · {plans}: {days} Tage kostenlos testen — keine Kosten bis Tag {until}, monatlich kündbar · Enterprise: nach Anfrage, kein Self-Service-Trial',
    pricingDisclaimerBefore:
      'Unsere Outputs sind methodisch und technisch fundiert — aber kein Ersatz für individuelle Rechtsberatung. ',
    pricingDisclaimerStrong: 'Wir versprechen kein "100 % rechtssicher"',
    pricingDisclaimerAfter:
      ', weil das niemand seriös kann. Generierte Dokumente empfehlen wir anwaltlich prüfen zu lassen.',
    // Landing v4 Hero (H1 + Lede). Produktname bleibt EN; „für Europa" lokalisiert.
    v4HeroTitleA: 'AI Compliance',
    v4HeroTitleB: 'Operations OS',
    v4HeroTitleEm: 'für Europa',
    v4HeroLede1: 'Runtime-Governance für regulierte KI.',
    v4HeroLede2: 'Kontinuierliche Evidenz. Menschliche Kontrolle. EU-nativ by Design.',
    // Landing v4 Workspace-Vorschau — sichtbare Beispiel-Kennzeichnung (keine Fake-KPIs).
    v4DashExampleBadge: 'Beispielansicht',
    v4DashExampleNote:
      'Beispieldaten – keine echten Messwerte. Ihre Werte entstehen aus Ihrem eigenen Scan.',
    v4DashExampleAria:
      'Beispielansicht des Governance-Dashboards mit Beispieldaten, keine echten Messwerte',
    // Landing v4 Roadmap — kundenorientierter Status, keine interne Registry-Sprache.
    v4RoadmapLede:
      'Was Sie heute nutzen können, was wir ausbauen und was als Nächstes kommt — ehrlich gekennzeichnet.',
    v4RoadmapFilterAll: 'Alle',
  },
  en: {
    brandName: 'RealSync Dynamics',
    navLogin: 'Login',
    langSwitch: 'Switch language',
    menuOpen: 'Open navigation',
    menuClose: 'Close navigation',
    mainNav: 'Main navigation',
    heroEyebrow: 'REALSYNCDYNAMICS.AI / CONTROL AND EVIDENCE LAYER FOR AI',
    ctaExplore: 'View the architecture',
    ctaEnterprise: 'Enterprise inquiry',
    loopExecute: 'EXECUTE',
    loopVerify: 'VERIFY',
    loopDiscover: 'DISCOVER',
    loopAssess: 'ASSESS',
    loopGovern: 'GOVERN',
    loopProve: 'PROVE',
    trustLine: 'Any model · Any agent · One control plane · Evidence as proof layer',
    heroActions: 'Hero actions',
    backHome: 'Back to home',
    emailLabel: 'E-mail',
    emailPlaceholder: 'first.last@company.com',
    sending: 'Sending …',
    linkSentBody: 'Open the link in the e-mail on this device — you will continue automatically.',
    resend: 'Correct the e-mail address and resend',
    orOauth: 'or sign in with an account',
    trustRuntime: 'Trust · Runtime',
    trustMono: 'Supabase EU (Frankfurt) · Magic link · Ed25519 · SHA-256 hash chain',
    resumeHint: 'You will continue right after signing in.',
    authNotConfigured: 'Auth is not configured (VITE_SUPABASE_URL missing).',
    sendFailed: 'Magic link could not be sent.',
    loginAborted: 'Sign-in aborted',
    auditOverline: 'Free audit · €0',
    stepCompany: 'Company',
    stepFrameworks: 'Frameworks',
    stepSystems: 'AI systems',
    stepRole: 'Role',
    stepResult: 'Result',
    companyLabel: 'Company',
    companyPlaceholder: 'Example Ltd',
    domainLabel: 'Primary domain',
    domainPlaceholder: 'example.com',
    reportEmailLabel: 'E-mail for the report',
    reportEmailHint: 'The scan needs a business e-mail to deliver the report.',
    followUpConsentLabel:
      'I would like occasional follow-up e-mails with offers and information about audit results. Unsubscribe anytime. (optional)',
    followUpConsentPrivacy: 'Privacy policy',
    comingSoon: 'Coming soon',
    roleSelf: 'Just me',
    roleTeam: 'Team up to five',
    roleAgency: 'Agency',
    roleEnterprise: 'Enterprise · SSO',
    runStart: 'Normalising domain',
    runRequest: 'Scan request sent to gdpr-audit',
    runWaiting: 'Waiting for the scan result …',
    runDone: 'Result received',
    runFailed: 'Scan failed',
    scoreLabel: 'Compliance score from the domain scan',
    scoreSource: 'Source: gdpr-audit · {domain}',
    noCriticalRisks: 'The scan reported no critical or high findings.',
    recWhy: 'Derived from role, frameworks and AI systems — not from the score.',
    toPlan: 'View plan',
    fullReport: 'Full report',
    retry: 'New scan',
    highRisk: 'High risk · Annex III',
    classPrefix: 'Class',
    popularBadge: 'Popular',
    selected: 'Selected',
    yearlyComingSoon: 'Yearly · coming soon',
    yearlyNote: 'Yearly billing cannot be booked yet — checkout is monthly for now.',
    bookMonthly: 'Book monthly',
    perMonth: '/ month',
    perYear: '/ year',
    onRequest: 'On request',
    once: 'one-off · no account',
    billingToggle: 'Billing period',
    moreInfo: 'Learn more',
    trialNote: '{days}-day free trial',
    residencyLabel: 'Where should AI data be processed? (optional)',
    residencyLocal: 'On-premises',
    residencyEu: 'EU cloud',
    residencyHybrid: 'Mixed / undecided',
    pricingTrustNote:
      'Free Audit free of charge · 14-day free trial · Cancel monthly · No setup fees · Made in Germany',
    pricingTrialFoot:
      'Free Audit free of charge · no account needed · {plans}: {days}-day free trial — no charge until day {until}, cancel monthly · Enterprise: on request, no self-service trial',
    pricingDisclaimerBefore:
      'Our outputs are methodologically and technically sound — but no substitute for individual legal advice. ',
    pricingDisclaimerStrong: 'We do not promise "100% legally secure"',
    pricingDisclaimerAfter:
      ', because nobody can seriously make that claim. We recommend having generated documents reviewed by counsel.',
    v4HeroTitleA: 'AI Compliance',
    v4HeroTitleB: 'Operations OS',
    v4HeroTitleEm: 'for Europe',
    v4HeroLede1: 'Runtime governance for regulated AI.',
    v4HeroLede2: 'Continuous evidence. Human control. EU-native by design.',
    v4DashExampleBadge: 'Example view',
    v4DashExampleNote:
      'Example data – not real measurements. Your values come from your own scan.',
    v4DashExampleAria:
      'Example view of the governance dashboard with sample data, not real measurements',
    v4RoadmapLede:
      'What you can use today, what we are building, and what comes next — labelled honestly.',
    v4RoadmapFilterAll: 'All',
  },
} as const;

export type HandoffKey = CopyKey | keyof (typeof HANDOFF_EXTRA)['de'] | HandoffAppKey;

/**
 * Übersetzung mit `{n}`-Platzhaltern. Reihenfolge: Korrektur → Handoff-Copy →
 * Zusatz-Strings. Fehlt ein Schlüssel in EN, fällt er auf DE zurück.
 */
export function translate(
  lang: Lang,
  key: HandoffKey,
  vars?: Record<string, string | number>,
): string {
  const override = HANDOFF_OVERRIDES[lang][key as CopyKey];
  const copy = (HANDOFF_COPY[lang] as Record<string, string>)[key];
  const extra = (HANDOFF_EXTRA[lang] as Record<string, string>)[key];
  const app = (HANDOFF_APP[lang] as Record<string, string>)[key];
  const fallback =
    (HANDOFF_COPY.de as Record<string, string>)[key] ??
    (HANDOFF_EXTRA.de as Record<string, string>)[key] ??
    (HANDOFF_APP.de as Record<string, string>)[key] ??
    key;
  let text = override ?? copy ?? extra ?? app ?? fallback;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
