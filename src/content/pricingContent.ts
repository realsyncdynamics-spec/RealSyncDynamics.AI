/**
 * Centralized Pricing & Features Content — Single Source of Truth
 * Konsumenten:
 *   - PricingPage (/pricing)
 *   - PlanDetailPage (/pricing/[slug])
 *   - FeatureDetailPage (/features/[slug])
 *   - CheckoutPage (/checkout/[slug])
 *
 * Alle ausführlichen Texte, Feature-Listen und Paketi-Beschreibungen
 * leben hier — nicht in den Komponenten duplizieren.
 */

export interface Feature {
  slug: string;
  title: string;
  subtitle: string;
  whatItDoes: string;
  whyItMatters: string;
  customerBenefit: string;
  includedInPlans: string[]; // Plan-Namen/Slugs
  icon?: string; // Optional: icon name
}

export interface PricingPlan {
  slug: string;
  name: string;
  price: number; // EUR, 0 für Free
  priceString: string; // "0 €", "79 €", "Individuelles Angebot"
  interval: string; // "monatlich", "einmalig", "individuell"
  badge?: string; // "Empfohlen", "Beliebt", etc.
  recommended: boolean;
  shortDescription: string;
  targetAudience: string;
  whatCustomerGets: string[]; // Bullet points
  cta: {
    label: string; // "Starter buchen", "Kostenlosen Audit starten", etc.
    href: string; // "/checkout/starter", etc.
  };
  checkoutPath: string;
  problemsSolved: string[]; // What problems does this plan solve?
  includedFeatureSlugs: string[]; // References to features
  // Detailed sections for the detail page
  detailedSections: {
    title: string;
    content: string;
  }[];
  // Trial info
  trial?: {
    days: number;
    description: string;
  };
}

export const featureDetails: Feature[] = [
  {
    slug: 'dsgvo-scan',
    title: 'DSGVO-Scan',
    subtitle: 'Automatische Website-Prüfung auf Datenschutzrisiken',
    whatItDoes: 'Der DSGVO-Scan prüft automatisch, welche Datenschutzrisiken auf einer Website sichtbar sind.',
    whyItMatters: 'Viele Websites binden Dienste, Cookies, Tracker, Schriftarten, Karten, Videos oder Analyse-Tools ein, ohne dass Betreiber genau wissen, wann diese geladen werden und ob die Datenschutzerklärung dazu passt.',
    customerBenefit: 'Der Kunde erhält eine klare Übersicht, welche Risiken bestehen und was konkret verbessert werden sollte.',
    includedInPlans: ['Free Audit', 'Starter', 'Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'consent-timing',
    title: 'Consent-Timing-Analyse',
    subtitle: 'Prüfung von Tracking vor Cookie-Einwilligung',
    whatItDoes: 'Die Consent-Timing-Analyse prüft, ob Tracking-Dienste bereits vor einer aktiven Cookie-Einwilligung geladen werden.',
    whyItMatters: 'Wenn Tracker vor Zustimmung feuern, kann das datenschutzrechtlich problematisch sein.',
    customerBenefit: 'Der Kunde erkennt, ob sein Cookie-Banner nur optisch vorhanden ist oder technisch wirklich funktioniert.',
    includedInPlans: ['Starter', 'Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'privacy-policy-generator',
    title: 'Datenschutzerklärungs-Generator',
    subtitle: 'Automatische Erstellung passender Datenschutzerklärungen',
    whatItDoes: 'Der Generator erstellt eine passende Datenschutzerklärung auf Basis der gefundenen Dienste und Website-Funktionen.',
    whyItMatters: 'Eine Datenschutzerklärung ist nur dann hilfreich, wenn sie zur tatsächlichen Website passt.',
    customerBenefit: 'Der Kunde spart Zeit und erhält eine strukturierte Grundlage für seine Datenschutzdokumentation.',
    includedInPlans: ['Starter', 'Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'evidence-vault',
    title: 'Evidence Vault',
    subtitle: 'Unveränderliches Archiv von Prüfungen und Nachweisen',
    whatItDoes: 'Der Evidence Vault speichert Prüfungen, Ergebnisse und Nachweise nachvollziehbar ab.',
    whyItMatters: 'Compliance ist nicht nur die Behebung eines Problems. Wichtig ist auch der Nachweis, dass geprüft, bewertet und gehandelt wurde.',
    customerBenefit: 'Der Kunde kann gegenüber Datenschutzbeauftragten, internen Stellen oder externen Prüfern belegen, welche Prüfungen durchgeführt wurden.',
    includedInPlans: ['Starter', 'Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'monitoring',
    title: 'Monitoring',
    subtitle: 'Regelmäßige Überwachung auf Änderungen',
    whatItDoes: 'Monitoring prüft regelmäßig, ob sich auf einer Website etwas verändert hat.',
    whyItMatters: 'Websites ändern sich ständig: neue Plugins, neue Skripte, neue Tracking-Dienste, neue Formulare oder externe Einbindungen.',
    customerBenefit: 'Der Kunde erkennt Änderungen frühzeitig, statt Risiken erst Monate später zu bemerken.',
    includedInPlans: ['Starter', 'Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'scheduler',
    title: 'Scheduler',
    subtitle: 'Geplante automatische Scans',
    whatItDoes: 'Der Scheduler plant automatische Scans täglich, wöchentlich oder monatlich.',
    whyItMatters: 'Regelmäßige Prüfung muss nicht manuell angestoßen werden.',
    customerBenefit: 'Der Kunde erhält einen wiederholbaren Prüfprozess und kann Compliance als laufenden Prozess betreiben.',
    includedInPlans: ['Starter', 'Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'auto-remediation',
    title: 'Auto-Remediation',
    subtitle: 'Konkrete Lösungsvorschläge und Code-Snippets',
    whatItDoes: 'Auto-Remediation liefert konkrete Lösungsvorschläge und Copy-Paste-Code für typische Probleme.',
    whyItMatters: 'Viele Tools zeigen nur ein Problem. RealSyncDynamics.AI zeigt dem Kunden auch, wie es gelöst werden kann.',
    customerBenefit: 'Der Kunde kann technische Korrektionen schneller umsetzen oder an Entwickler weitergeben.',
    includedInPlans: ['Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'ai-risk-register',
    title: 'AI Risk Register',
    subtitle: 'Strukturierte KI-Governance und Risikoverwaltung',
    whatItDoes: 'Das AI Risk Register sammelt KI-Tools, KI-Anwendungsfälle, Risiken, Verantwortlichkeiten und Maßnahmen an einem Ort.',
    whyItMatters: 'Unternehmen nutzen oft KI, ohne zentrale Übersicht über Tools, Daten, Risiken und Zuständigkeiten zu haben.',
    customerBenefit: 'Der Kunde bekommt eine strukturierte Grundlage für KI-Governance und interne Kontrolle.',
    includedInPlans: ['Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'ki-governance',
    title: 'KI-Governance',
    subtitle: 'Erfassung und Dokumentation von KI-Systemen',
    whatItDoes: 'KI-Governance hilft Unternehmen, den Einsatz von KI-Systemen zu erfassen, zu bewerten und zu dokumentieren.',
    whyItMatters: 'KI-Nutzung muss nachvollziehbar, verantwortbar und prüfbar sein, besonders bei sensiblen Daten oder regulierten Prozessen.',
    customerBenefit: 'Der Kunde kann KI-Nutzung nicht nur technisch, sondern organisatorisch steuern.',
    includedInPlans: ['Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'governance-agents',
    title: 'Governance Agents',
    subtitle: 'Intelligente Assistenten für Compliance-Aufgaben',
    whatItDoes: 'Governance Agents sind intelligente Assistenten, die Prüf-, Dokumentations- und Analyseaufgaben unterstützen.',
    whyItMatters: 'Viele Compliance-Aufgaben sind wiederkehrend und zeitintensiv.',
    customerBenefit: 'Der Kunde spart Zeit und bekommt strukturierte Unterstützung bei laufender Governance-Arbeit.',
    includedInPlans: ['Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'bots',
    title: 'Bots',
    subtitle: 'Chatbots für automatisierte Kundeninteraktion',
    whatItDoes: 'Bots unterstützen Kundenservice, Terminbuchung, Bestellannahmen oder einfache Support-Prozesse über Chat, Telegram, WhatsApp oder Voice.',
    whyItMatters: 'Viele Unternehmen brauchen automatisierte Kommunikation, ohne sofort ein eigenes KI-System aufzubauen.',
    customerBenefit: 'Der Kunde kann wiederkehrende Anfragen automatisieren und gleichzeitig Governance und Nachweisbarkeit berücksichtigen.',
    includedInPlans: ['Growth', 'Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'bulk-jobs',
    title: 'Bulk Jobs',
    subtitle: 'Stapelverarbeitung von Prüfungen',
    whatItDoes: 'Bulk Jobs ermöglichen die automatisierte Prüfung vieler Websites, Seiten oder Kundenprojekte in einem Durchlauf.',
    whyItMatters: 'Agenturen, Kanzleien und Datenschutzbeauftragte prüfen selten nur eine einzelne Website. Sie brauchen Stapelverarbeitung.',
    customerBenefit: 'Der Kunde kann viele Prüfungen parallel oder geplant durchführen, spart Zeit und erhält einheitliche Ergebnisse.',
    includedInPlans: ['Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'c2pa-herkunftsnachweis',
    title: 'C2PA-Herkunftsnachweis',
    subtitle: 'Dokumentation von Content-Herkunft und Bearbeitung',
    whatItDoes: 'Der Herkunftsnachweis dokumentiert, woher digitale Inhalte stammen, ob sie verändert wurden und welche Metadaten zur Herkunft vorhanden sind.',
    whyItMatters: 'Durch KI-generierte Inhalte, Bildbearbeitung und automatisierte Content-Produktion wird es immer wichtiger, Herkunft und Bearbeitung nachvollziehbar zu machen.',
    customerBenefit: 'Der Kunde kann Inhalte besser prüfen, kennzeichnen und dokumentieren. Das hilft bei Vertrauen, Nachweisbarkeit, Markenrisiko und Compliance.',
    includedInPlans: ['Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'branchenbibliotheken',
    title: 'Branchenbibliotheken',
    subtitle: 'Vorbereitete Prüf- und Lösungsmuster für Branchen',
    whatItDoes: 'Branchenbibliotheken liefern vorbereitete Prüf- und Lösungsmuster für typische Branchen.',
    whyItMatters: 'Eine Arztpraxis, ein Onlineshop, eine Kanzlei und ein Industriebetrieb haben unterschiedliche Risiken und Pflichten.',
    customerBenefit: 'Der Kunde startet nicht bei null, sondern nutzt passende Vorlagen für seine Branche.',
    includedInPlans: ['Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'api-zugriff',
    title: 'API-Zugriff',
    subtitle: 'Anbindung an eigene Systeme und Workflows',
    whatItDoes: 'API-Zugriff ermöglicht die Anbindung von RealSyncDynamics.AI an eigene Systeme.',
    whyItMatters: 'Professionelle Kunden möchten Prüfungen, Reports und Statusdaten oft in eigene Workflows integrieren.',
    customerBenefit: 'Der Kunde kann RealSyncDynamics.AI in bestehende Tools, Dashboards oder Kundenportale einbinden.',
    includedInPlans: ['Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'white-label',
    title: 'White-Label',
    subtitle: 'Reports und Portale mit eigenem Branding',
    whatItDoes: 'White-Label ermöglicht Reports und Portale mit eigenem Logo und eigener Darstellung.',
    whyItMatters: 'Agenturen, Kanzleien und Datenschutzbeauftragte wollen Ergebnisse professionell unter eigener Marke präsentieren.',
    customerBenefit: 'Der Kunde kann RealSyncDynamics.AI als eigenen Service gegenüber Mandanten oder Kunden einsetzen.',
    includedInPlans: ['Agency', 'Scale', 'Enterprise'],
  },
  {
    slug: 'multi-tenant-dashboard',
    title: 'Multi-Tenant Dashboard',
    subtitle: 'Zentrale Verwaltung mehrerer Mandanten',
    whatItDoes: 'Das Multi-Tenant Dashboard verwaltet mehrere Kunden, Mandanten oder Websites zentral.',
    whyItMatters: 'Bei vielen Kunden reicht eine einfache Einzelansicht nicht mehr aus.',
    customerBenefit: 'Der Kunde sieht Risiken, Status und offene Aufgaben über alle Mandanten hinweg.',
    includedInPlans: ['Scale', 'Enterprise'],
  },
  {
    slug: 'kodee-vps-assistent',
    title: 'Kodee VPS-Assistent',
    subtitle: 'Support bei Server- und Infrastrukturproblemen',
    whatItDoes: 'Der Kodee VPS-Assistent unterstützt bei Server-, DNS-, SSL-, Sicherheits- und Infrastrukturproblemen.',
    whyItMatters: 'Viele Datenschutz- und Sicherheitsprobleme entstehen nicht nur im Frontend, sondern auch durch Server- und DNS-Konfiguration.',
    customerBenefit: 'Der Kunde bekommt Unterstützung bei technischen Infrastrukturthemen, die sonst oft zwischen Agentur, Hoster und Entwickler hängen bleiben.',
    includedInPlans: ['Agency', 'Scale', 'Enterprise'],
  },
];

export const pricingPlans: PricingPlan[] = [
  {
    slug: 'free-audit',
    name: 'Free Audit',
    price: 0,
    priceString: '0 €',
    interval: 'einmalig',
    recommended: false,
    shortDescription: 'Der kostenlose Schnellcheck für Unternehmen, die wissen möchten, ob ihre Website offensichtliche DSGVO-Risiken enthält.',
    targetAudience: 'Für Selbstständige, kleine Unternehmen, Agenturen und Betreiber von Webseiten, die ohne Account und ohne Einrichtung einen ersten Risikowert erhalten möchten.',
    whatCustomerGets: [
      'Eingabe der Website-Adresse',
      'Automatischer Schnellscan',
      'Risikowert von 0 bis 100',
      'Erste Hinweise zu Datenschutz-, Cookie-, Tracking- und Website-Risiken',
      'Kein Setup notwendig',
      'Kein Account erforderlich',
      'Ideal zum Testen',
    ],
    cta: {
      label: 'Kostenlosen Audit starten',
      href: '/checkout/free-audit',
    },
    checkoutPath: '/checkout/free-audit',
    problemsSolved: [
      'Unsicherheit, ob die Website DSGVO-konform ist',
      'Keine Übersicht über Datenschutzrisiken',
      'Schnelle erste Orientierung gewünscht',
    ],
    includedFeatureSlugs: ['dsgvo-scan'],
    detailedSections: [
      {
        title: 'Wie funktioniert der Free Audit?',
        content: 'Free Audit ist der Einstieg in RealSyncDynamics.AI. Der Kunde gibt seine Website-Adresse ein und erhält einen ersten automatisierten Risikowert. Dieser Schnellcheck zeigt, ob grundlegende Datenschutzrisiken bestehen, etwa durch Tracking, Cookies, fehlende Pflichtseiten, problematische externe Dienste oder technische Schwachstellen. Der Free Audit ersetzt keine vollständige Prüfung, hilft aber dabei, schnell zu erkennen, ob Handlungsbedarf besteht.',
      },
    ],
  },
  {
    slug: 'starter',
    name: 'Starter',
    price: 79,
    priceString: '79 €',
    interval: 'monatlich',
    recommended: false,
    badge: undefined,
    shortDescription: 'Die solide Grundausstattung für kleinere Unternehmen, die ihre Website regelmäßig prüfen und Datenschutzrisiken nachvollziehbar dokumentieren möchten.',
    targetAudience: 'Für kleine Unternehmen, Praxen, Kanzleien, Handwerker, lokale Dienstleister und Betreiber einzelner Webseiten.',
    whatCustomerGets: [
      'Vollständiger DSGVO-Scan',
      'Genaue Regel- und Risiko-Hinweise',
      'Automatische Datenschutzerklärung',
      'Konkrete Verbesserungsvorschläge für Cookies und Tracking',
      'Laufendes Monitoring',
      'Audit-Beweise für Datenschutzbeauftragte oder interne Dokumentation',
      '25 automatisierte Scan-Läufe pro Monat',
    ],
    cta: {
      label: 'Starter buchen',
      href: '/checkout/starter',
    },
    checkoutPath: '/checkout/starter',
    problemsSolved: [
      'Unsicherheit, ob Tracker oder Cookies problematisch eingebunden sind',
      'Fehlende Übersicht über Datenschutzrisiken',
      'Keine Dokumentation bisheriger Prüfungen',
      'Manuelle Prüfung kostet zu viel Zeit',
      'Datenschutzerklärung muss aktuell gehalten werden',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
    ],
    detailedSections: [
      {
        title: 'Was bekommt der Kunde konkret?',
        content: 'Starter ist für Unternehmen gedacht, die nicht nur einmal prüfen wollen, sondern eine laufende Grundabsicherung brauchen. Die Website wird regelmäßig gescannt. Der Kunde sieht, welche Dienste gefunden wurden, welche Datenschutzrisiken bestehen und welche Maßnahmen empfohlen werden. Besonders wichtig ist die Nachweisbarkeit: Das System dokumentiert, dass geprüft wurde. Dadurch entsteht ein prüfbarer Verlauf, der bei Datenschutzanfragen, internen Kontrollen oder externer Beratung hilfreich ist.',
      },
    ],
    trial: {
      days: 14,
      description: '14 Tage kostenlos testen, keine Kosten bis Tag 15, monatlich kündbar',
    },
  },
  {
    slug: 'growth',
    name: 'Growth',
    price: 249,
    priceString: '249 €',
    interval: 'monatlich',
    recommended: true,
    badge: 'Empfohlen',
    shortDescription: 'Der Smart-Plan für Unternehmen und Agenturen, die Website-Compliance, KI-Governance und laufende Risikoübersicht in einem System verbinden möchten.',
    targetAudience: 'Für mittlere Unternehmen, digitale Teams, Agenturen mit mehreren Kundenwebsites und Organisationen, die bereits KI-Tools einsetzen.',
    whatCustomerGets: [
      'Alle Starter-Features plus:',
      'KI-Governance',
      'AI Risk Register',
      'Täglich aktualisiertes Risiko-Dashboard',
      'Copy-Paste-Lösungen und Code-Snippets',
      'Chatbots für Chat, Telegram und WhatsApp',
      'Bis zu 2.000 Bot-Antworten pro Monat',
      '100 automatisierte Läufe pro Monat',
      'Auto-Remediation',
    ],
    cta: {
      label: 'Growth buchen',
      href: '/checkout/growth',
    },
    checkoutPath: '/checkout/growth',
    problemsSolved: [
      'KI-Tools werden genutzt, aber nicht dokumentiert',
      'Risiken sind über E-Mails, Excel und einzelne Personen verteilt',
      'Datenschutz und KI-Governance laufen getrennt',
      'Änderungen auf Webseiten werden zu spät erkannt',
      'Technische Korrektionen fehlen oder sind unklar',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
      'auto-remediation',
      'ai-risk-register',
      'ki-governance',
      'bots',
    ],
    detailedSections: [
      {
        title: 'Was macht Growth besonders?',
        content: 'Growth erweitert die klassische Website-Compliance um KI-Governance. Der Kunde kann nicht nur Datenschutzrisiken auf Webseiten prüfen, sondern auch KI-Nutzung, KI-Tools und KI-Risiken strukturiert erfassen. Das AI Risk Register zeigt, welche KI-Systeme eingesetzt werden, welche Risiken bestehen und welche Maßnahmen dokumentiert werden sollten. Growth ist deshalb der empfohlene Plan für Unternehmen, die nicht nur reagieren, sondern laufend kontrollieren wollen.',
      },
    ],
    trial: {
      days: 14,
      description: '14 Tage kostenlos testen, keine Kosten bis Tag 15, monatlich kündbar',
    },
  },
  {
    slug: 'agency',
    name: 'Agency',
    price: 699,
    priceString: '699 €',
    interval: 'monatlich',
    recommended: false,
    shortDescription: 'Die Profi-Suite für Datenschutzbeauftragte, Kanzleien und Agenturen, die mehrere Kunden professionell prüfen, dokumentieren und betreuen möchten.',
    targetAudience: 'Für externe Datenschutzbeauftragte, Datenschutzkanzleien, Webagenturen, IT-Dienstleister und Compliance-Berater.',
    whatCustomerGets: [
      'Alle Growth-Features plus:',
      'Branchenbibliotheken',
      'Governance Agents',
      '10 Bot-Instanzen',
      'Chatbots für Voice, Chat, Telegram und WhatsApp',
      '10.000 Bot-Antworten pro Monat',
      '500 Voice-Minuten pro Monat',
      'API-Zugriff',
      'Kodee VPS-Assistent',
      'White-Label-Reports mit eigenem Logo',
      'Automatische Audit-Dokumentation',
      '500 automatisierte Läufe pro Monat',
    ],
    cta: {
      label: 'Agency buchen',
      href: '/checkout/agency',
    },
    checkoutPath: '/checkout/agency',
    problemsSolved: [
      'Viele Kunden müssen regelmäßig geprüft werden',
      'Reports sollen professionell und mit eigenem Branding ausgegeben werden',
      'Manuelle Dokumentation bindet zu viel Zeit',
      'Kundenbranchen benötigen unterschiedliche Vorlagen',
      'Technische Risiken müssen nachvollziehbar erklärt werden',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
      'auto-remediation',
      'ai-risk-register',
      'ki-governance',
      'governance-agents',
      'bots',
      'bulk-jobs',
      'c2pa-herkunftsnachweis',
      'branchenbibliotheken',
      'api-zugriff',
      'white-label',
      'kodee-vps-assistent',
    ],
    detailedSections: [
      {
        title: 'Für wen ist Agency gedacht?',
        content: 'Agency ist für professionelle Dienstleister gedacht, die Compliance nicht nur für sich selbst, sondern für viele Kunden liefern. Der Plan kombiniert wiederholbare Prüfungen, White-Label-Berichte, API-Anbindung und Automatisierung. Agenturen und Datenschutzbeauftragte können Prüfungen standardisieren, Ergebnisse sauber dokumentieren und Kunden strukturierter betreuen. Die Governance Agents helfen dabei, wiederkehrende Prüf- und Dokumentationsaufgaben zu automatisieren.',
      },
    ],
    trial: {
      days: 14,
      description: '14 Tage kostenlos testen, keine Kosten bis Tag 15, monatlich kündbar',
    },
  },
  {
    slug: 'scale',
    name: 'Scale',
    price: 1999,
    priceString: '1.999 €',
    interval: 'monatlich',
    recommended: false,
    shortDescription: 'Die Multi-Mandanten-Lösung für Kanzleien, Datenschutzunternehmen und große Agenturen mit bis zu 50 Kundenwebsites.',
    targetAudience: 'Für Organisationen, die viele Mandanten, Kundenprojekte oder Websites zentral verwalten und skalierbar prüfen müssen.',
    whatCustomerGets: [
      'Alle Agency-Features plus:',
      'Multi-Tenant Dashboard',
      'Verwaltung von bis zu 50 Kundenwebsites',
      'Eigene White-Label-Subdomain (z.B. dsb.ihre-kanzlei.de)',
      'SLA 4h Support',
      'Unbegrenzte API-Nutzung',
      'Erweiterte Mandantenübersicht',
      'Strukturierte Kundenverwaltung',
    ],
    cta: {
      label: 'Scale buchen',
      href: '/checkout/scale',
    },
    checkoutPath: '/checkout/scale',
    problemsSolved: [
      'Zu viele einzelne Kundenprüfungen ohne zentrale Übersicht',
      'Kein einheitlicher Prüfstatus über alle Mandanten',
      'Fehlende Skalierung bei Agentur- oder Kanzleiwachstum',
      'Manuelle Report- und Nachweisprozesse',
      'Wunsch nach eigenem Compliance-Portal unter eigener Marke',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
      'auto-remediation',
      'ai-risk-register',
      'ki-governance',
      'governance-agents',
      'bots',
      'bulk-jobs',
      'c2pa-herkunftsnachweis',
      'branchenbibliotheken',
      'api-zugriff',
      'white-label',
      'multi-tenant-dashboard',
      'kodee-vps-assistent',
    ],
    detailedSections: [
      {
        title: 'Warum Scale für große Organisationen sinnvoll ist',
        content: 'Scale ist für professionelle Anbieter gedacht, die Compliance als laufenden Service für viele Kunden betreiben. Statt einzelne Webseiten isoliert zu prüfen, erhält der Kunde eine zentrale Multi-Mandanten-Ansicht. Dadurch lassen sich Risiken, Prüfstatus, Nachweise und offene Aufgaben über viele Kunden hinweg steuern. Die eigene Subdomain macht das System als White-Label-Lösung nutzbar.',
      },
    ],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    price: 0,
    priceString: 'Individuelles Angebot',
    interval: 'individuell',
    recommended: false,
    shortDescription: 'Für große Unternehmen, regulierte Branchen und Organisationen mit besonderen Anforderungen an Sicherheit, Integration, Rollen, Datenhaltung und Governance.',
    targetAudience: 'Für Konzerne, regulierte Unternehmen, Behörden, Finanzdienstleister, Versicherungen, Industrieunternehmen und Organisationen mit individuellen Compliance-Prozessen.',
    whatCustomerGets: [
      'Individuelle Konfiguration',
      'Erweiterte Rollen- und Rechtekonzepte',
      'Angepasste Workflows',
      'Besondere Integrationen',
      'Individuelle Daten- und Sicherheitsanforderungen',
      'Optional: eigene Infrastruktur oder besondere Betriebsmodelle',
      'Erweiterte Governance- und Reporting-Strukturen',
    ],
    cta: {
      label: 'Enterprise-Konfiguration vorbereiten',
      href: '/checkout/enterprise',
    },
    checkoutPath: '/checkout/enterprise',
    problemsSolved: [
      'Anforderungen gehen über Standard-Pakete hinaus',
      'Besondere Compliance-Regeln notwendig',
      'Interne Freigabeprozesse erforderlich',
      'Regulatorische Besonderheiten',
      'Komplexe Integrationen in bestehende Systeme',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
      'auto-remediation',
      'ai-risk-register',
      'ki-governance',
      'governance-agents',
      'bots',
      'bulk-jobs',
      'c2pa-herkunftsnachweis',
      'branchenbibliotheken',
      'api-zugriff',
      'white-label',
      'multi-tenant-dashboard',
      'kodee-vps-assistent',
    ],
    detailedSections: [
      {
        title: 'Was ist das Enterprise-Paket?',
        content: 'Enterprise ist für Organisationen gedacht, deren Anforderungen über Standardpakete hinausgehen. Dazu gehören besondere Compliance-Regeln, interne Freigabeprozesse, regulatorische Anforderungen, Integrationen in bestehende Systeme und individuelle Sicherheitskonzepte. Der Plan wird nicht pauschal gebucht, sondern passend zur Organisation vorbereitet.',
      },
    ],
  },
  // ─── Jahres-Varianten — 12 Monate zum Preis von 10 (2-Monate-Rabatt) ───
  // Slugs identisch zur TierId in src/config/pricing.ts, damit die Info-
  // Buttons der Pricing-Karten (/pricing/<tier.id>) auf echte Detailseiten
  // führen statt auf /pricing zurückzubouncen.
  {
    slug: 'starter_yearly',
    name: 'Starter (Jährlich)',
    price: 790,
    priceString: '790 €',
    interval: 'pro Jahr — 12 Monate zum Preis von 10',
    recommended: false,
    badge: 'Sparen Sie 2 Monate',
    shortDescription: 'Starter mit Jahresabrechnung und 2-Monate-Rabatt: 79 € × 10 = 790 € pro Jahr. Gleicher Funktionsumfang wie Starter (monatlich), ein Jahr durchgehende DSGVO-Grundabsicherung.',
    targetAudience: 'Für kleine Unternehmen, Praxen, Kanzleien und lokale Dienstleister, die sich für ein Jahr absichern und dabei 2 Monatsraten sparen möchten.',
    whatCustomerGets: [
      'Alles aus Starter (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'Kontinuierliche DSGVO-Compliance ohne Unterbrechung',
    ],
    cta: {
      label: '14 Tage kostenlos testen',
      href: '/checkout/starter_yearly?source=pricing&pilot=true',
    },
    checkoutPath: '/checkout/starter_yearly',
    problemsSolved: [
      'Monatliche Abrechnung erzeugt unnötigen Verwaltungsaufwand',
      'Compliance-Budget soll planbar fürs ganze Jahr sein',
      'Schutzlücken durch versehentlich ausgelaufene Monats-Abos',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
    ],
    detailedSections: [
      {
        title: 'Warum die Jahresvariante?',
        content: 'Die Jahresabrechnung bündelt 12 Monate Starter zum Preis von 10 Monaten. Der Funktionsumfang ist identisch zur monatlichen Variante — laufende Scans, Risiko-Hinweise, automatische Datenschutzerklärung und der prüfbare Nachweis-Verlauf. Für Unternehmen mit festem Jahresbudget entfällt die monatliche Rechnungsstellung.',
      },
    ],
    trial: {
      days: 14,
      description: '14 Tage kostenlos testen, keine Kosten bis Tag 15',
    },
  },
  {
    slug: 'growth_yearly',
    name: 'Growth (Jährlich)',
    price: 2490,
    priceString: '2.490 €',
    interval: 'pro Jahr — 12 Monate zum Preis von 10',
    recommended: true,
    badge: 'Empfohlen',
    shortDescription: 'Growth mit Jahresabrechnung und 2-Monate-Rabatt: 249 € × 10 = 2.490 € pro Jahr. KI-Governance, AI Risk Register und tägliches Monitoring für ein ganzes Jahr.',
    targetAudience: 'Für wachsende Unternehmen mit KI-Einsatz, die Governance-Prozesse für ein Jahr fest verankern und dabei 2 Monatsraten sparen möchten.',
    whatCustomerGets: [
      'Alles aus Growth (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'KI-Governance + AI Risk Register für das ganze Jahr',
    ],
    cta: {
      label: '14 Tage kostenlos testen',
      href: '/checkout/growth_yearly?source=pricing&pilot=true',
    },
    checkoutPath: '/checkout/growth_yearly',
    problemsSolved: [
      'KI-Compliance braucht Kontinuität statt Monats-Flickwerk',
      'Compliance-Budget soll planbar fürs ganze Jahr sein',
      'AI-Act-Pflichten gelten dauerhaft, nicht monatsweise',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
      'auto-remediation',
      'ai-risk-register',
      'ki-governance',
      'bots',
    ],
    detailedSections: [
      {
        title: 'Warum die Jahresvariante?',
        content: 'Die Jahresabrechnung bündelt 12 Monate Growth zum Preis von 10 Monaten. KI-Governance und das AI Risk Register laufen ohne Unterbrechung durch — wichtig, weil AI-Act- und DSGVO-Pflichten kontinuierlich gelten. Der Funktionsumfang ist identisch zur monatlichen Variante.',
      },
    ],
    trial: {
      days: 14,
      description: '14 Tage kostenlos testen, keine Kosten bis Tag 15',
    },
  },
  {
    slug: 'agency_yearly',
    name: 'Agency (Jährlich)',
    price: 6900,
    priceString: '6.900 €',
    interval: 'pro Jahr — 12 Monate zum Preis von 10',
    recommended: false,
    badge: 'Sparen Sie 2 Monate',
    shortDescription: 'Agency mit Jahresabrechnung und 2-Monate-Rabatt: 699 € × 10 = 6.900 € pro Jahr. Branchenbibliotheken, White-Label und API-Zugriff für ein ganzes Jahr.',
    targetAudience: 'Für Datenschutzkanzleien, Agenturen und Compliance-Berater, die Mandanten langfristig betreuen und Jahresbudgets bevorzugen.',
    whatCustomerGets: [
      'Alles aus Agency (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'Branchenbibliothek + White-Label für das ganze Jahr',
    ],
    cta: {
      label: 'Agency jährlich testen',
      href: '/checkout/agency_yearly?source=pricing&pilot=true',
    },
    checkoutPath: '/checkout/agency_yearly',
    problemsSolved: [
      'Mandanten-Betreuung ist auf Jahre angelegt, nicht auf Monate',
      'Compliance-Budget soll planbar fürs ganze Jahr sein',
      'White-Label-Angebote brauchen verlässliche Laufzeiten',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
      'auto-remediation',
      'ai-risk-register',
      'ki-governance',
      'governance-agents',
      'bots',
      'bulk-jobs',
      'c2pa-herkunftsnachweis',
      'branchenbibliotheken',
      'api-zugriff',
      'white-label',
      'kodee-vps-assistent',
    ],
    detailedSections: [
      {
        title: 'Warum die Jahresvariante?',
        content: 'Die Jahresabrechnung bündelt 12 Monate Agency zum Preis von 10 Monaten. Für Kanzleien und Agenturen, die Mandate über Jahresverträge abrechnen, passt die Laufzeit damit zum eigenen Geschäftsmodell. Der Funktionsumfang ist identisch zur monatlichen Variante.',
      },
    ],
    trial: {
      days: 14,
      description: '14 Tage kostenlos testen, keine Kosten bis Tag 15',
    },
  },
  {
    slug: 'scale_yearly',
    name: 'Scale (Jährlich)',
    price: 19000,
    priceString: '19.000 €',
    interval: 'pro Jahr — 12 Monate zum Preis von 10',
    recommended: false,
    badge: 'Reseller',
    shortDescription: 'Scale mit Jahresabrechnung und 2-Monate-Rabatt: 1.999 € × 10 = 19.000 € pro Jahr. Multi-Tenant-Verwaltung für bis zu 50 Mandanten, ein ganzes Jahr.',
    targetAudience: 'Für DSB-Kanzleien, Datenschutzunternehmen und große Agenturen mit vielen Mandanten und jahresbasierter Budgetplanung.',
    whatCustomerGets: [
      'Alles aus Scale (monatlich)',
      '2-Monate-Rabatt: zahle 10, nutze 12 Monate',
      'Automatische Jahres-Verlängerung',
      'Multi-Tenant für bis zu 50 Mandanten das ganze Jahr',
    ],
    cta: {
      label: 'Scale jährlich anfragen',
      href: '/contact-sales?tier=scale_yearly&source=pricing',
    },
    checkoutPath: '/checkout/scale_yearly',
    problemsSolved: [
      'Multi-Mandanten-Betrieb braucht verlässliche Jahreslaufzeiten',
      'Compliance-Budget soll planbar fürs ganze Jahr sein',
      'Reseller-Kalkulation basiert auf Jahrespreisen',
    ],
    includedFeatureSlugs: [
      'dsgvo-scan',
      'consent-timing',
      'privacy-policy-generator',
      'evidence-vault',
      'monitoring',
      'scheduler',
      'auto-remediation',
      'ai-risk-register',
      'ki-governance',
      'governance-agents',
      'bots',
      'bulk-jobs',
      'c2pa-herkunftsnachweis',
      'branchenbibliotheken',
      'api-zugriff',
      'white-label',
      'multi-tenant-dashboard',
      'kodee-vps-assistent',
    ],
    detailedSections: [
      {
        title: 'Warum die Jahresvariante?',
        content: 'Die Jahresabrechnung bündelt 12 Monate Scale zum Preis von 10 Monaten. Multi-Tenant-Betreiber kalkulieren ihre Mandantenpreise üblicherweise auf Jahresbasis — die Jahresvariante passt Einkaufs- und Verkaufslogik aneinander an. Der Funktionsumfang ist identisch zur monatlichen Variante.',
      },
    ],
  },
];

/**
 * Helper-Funktionen
 */

export function getPlanBySlug(slug: string): PricingPlan | undefined {
  return pricingPlans.find((p) => p.slug === slug);
}

export function getFeatureBySlug(slug: string): Feature | undefined {
  return featureDetails.find((f) => f.slug === slug);
}

export function getPlansByFeature(featureSlug: string): PricingPlan[] {
  const feature = getFeatureBySlug(featureSlug);
  if (!feature) return [];
  return pricingPlans.filter((plan) => feature.includedInPlans.includes(plan.name));
}

export function getFeaturesByPlan(planSlug: string): Feature[] {
  const plan = getPlanBySlug(planSlug);
  if (!plan) return [];
  return plan.includedFeatureSlugs
    .map((slug) => getFeatureBySlug(slug))
    .filter((f): f is Feature => f !== undefined);
}

export const ALL_PLAN_SLUGS = pricingPlans.map((p) => p.slug);
export const ALL_FEATURE_SLUGS = featureDetails.map((f) => f.slug);
