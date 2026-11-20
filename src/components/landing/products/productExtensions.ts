/**
 * Produkterweiterungen der bestehenden weißen RealSync-Seitenfamilie (#2344).
 * Nur Inhalte und Beispielabläufe; produktive Funktionen bleiben unabhängig abnahmebedürftig.
 */
import type { ProductLandingContent } from './productContent';

export const EXTENDED_PRODUCT_CONTENT = {
  "software-factory": {
    "key": "software-factory",
    "source": "software-factory-product",
    "name": "Software Factory",
    "audience": "Für kontrollierte KI-Softwareentwicklung",
    "h1": [
      "Aus Anforderungen.",
      "Wird überprüfbarer Code."
    ],
    "lead": "Die geplante Entwicklungsstrecke verbindet spezifizierte Aufgaben, isolierte Änderungen und nachprüfbare Qualitätssicherung.",
    "primary": {
      "label": "Geplanten Ablauf ansehen",
      "to": "#ablauf"
    },
    "secondary": {
      "label": "Governance OS entdecken",
      "to": "/governance-os"
    },
    "status": [
      {
        "label": "Software Factory",
        "registryId": "software-factory-product"
      }
    ],
    "stageTag": "Software Factory · Produktentwurf",
    "stageCaption": "Spezifikation → Branch → Tests → Freigabe",
    "promiseTitle": "Drei Bausteine. Ein kontrollierter Ablauf.",
    "promises": [
      {
        "title": "Klarer Auftrag",
        "body": "Anforderungen und Grenzen vor dem Start dokumentieren."
      },
      {
        "title": "Isolierte Änderungen",
        "body": "Arbeit in kontrollierten Branches statt direkt auf main."
      },
      {
        "title": "Nachweise vor Freigabe",
        "body": "Tests und Reviews dokumentieren; kein autonomes Live-Schalten."
      }
    ],
    "flow": {
      "eyebrow": "Schritt für Schritt · Beispiel",
      "title": "So könnte es funktionieren.",
      "text": "Die Darstellung zeigt einen geplanten Ablauf, keine freigegebene produktive Ausführung.",
      "panelLabel": "Software Factory · Beispiel",
      "steps": [
        {
          "title": "Spezifikation",
          "action": "Ein Entwicklungsauftrag wird mit Abnahmekriterien beschrieben.",
          "result": "Ein überprüfbarer Arbeitsauftrag liegt vor."
        },
        {
          "title": "Branch",
          "action": "Ein KI-Agent bereitet eine isolierte Änderung vor.",
          "result": "Änderungen bleiben von der Produktivversion getrennt."
        },
        {
          "title": "Prüfung",
          "action": "Automatisierte Tests und Reviewer prüfen den Stand.",
          "result": "Ergebnisse und offene Probleme werden sichtbar."
        },
        {
          "title": "Freigabe",
          "action": "Ein berechtigter Mensch entscheidet über weitere Schritte.",
          "result": "Ein Release erfolgt nicht automatisch."
        }
      ],
      "fine": "Illustrativer Ablauf ohne Verbindung zu einem Kundenkonto oder einem produktiven Workflow."
    },
    "casesTitle": "Geplante Einsatzmöglichkeiten.",
    "cases": [
      {
        "trade": "Webanwendung",
        "situation": "Eine neue Funktion muss nachvollziehbar gebaut werden.",
        "result": "Prüfbarer Änderungsvorschlag mit Testergebnissen."
      },
      {
        "trade": "Wartung",
        "situation": "Ein Fehler soll behoben werden, ohne Live-Risiken zu ignorieren.",
        "result": "Isolierter Fix zur menschlichen Prüfung."
      },
      {
        "trade": "Plattform",
        "situation": "Mehrere Module benötigen denselben Qualitätsmaßstab.",
        "result": "Gemeinsamer Prüfpfad statt separater Infrastruktur."
      }
    ],
    "startSteps": [
      {
        "title": "Anforderungen",
        "body": "Funktion und Qualitätskriterien festhalten."
      },
      {
        "title": "Vorschau",
        "body": "Ergebnisse und Prüfungen kontrollieren."
      },
      {
        "title": "Freigabe",
        "body": "Über einen möglichen Einsatz gesondert entscheiden."
      }
    ],
    "pricingTitle": "Produktstatus und Verfügbarkeit.",
    "pricingMode": "roadmap",
    "limits": "Software Factory ist nicht als eigenständiges Kundenprodukt freigegeben. Die Agent-OS-Teilkomponente ist eine Preview; autonome PR-Merges und Produktionsdeploys sind nicht erlaubt.",
    "cta": {
      "title": "Mehr Möglichkeiten unter einem Dach.",
      "text": "Die geplanten Module nutzen künftig die gemeinsame RealSync-Plattform. Bestehende Governance, Login und Mandantentrennung bleiben erhalten.",
      "primary": {
        "label": "Alle Produkte ansehen",
        "to": "/#produkte"
      },
      "secondary": {
        "label": "Governance OS entdecken",
        "to": "/governance-os"
      }
    },
    "faqs": [
      {
        "q": "Läuft die Software Factory autonom?",
        "a": "Nein. Produktionsmerges, Migrationen und Deployments erfordern individuelle Freigaben."
      },
      {
        "q": "Ist das ein freigegebenes Kundenprodukt?",
        "a": "Nein. Die Software Factory befindet sich in Entwicklung; die Agent OS-Teilkomponente ist Preview."
      }
    ]
  },
  "automation-os": {
    "key": "automation-os",
    "source": "automation-os-product",
    "name": "Automation OS",
    "audience": "Für wiederkehrende Geschäftsabläufe",
    "h1": [
      "Routine reduzieren.",
      "Kontrolle behalten."
    ],
    "lead": "Workflows, geplante Abläufe und Freigaben sollen auf derselben RealSync-Laufzeit zusammengeführt werden.",
    "primary": {
      "label": "Geplanten Ablauf ansehen",
      "to": "#ablauf"
    },
    "secondary": {
      "label": "Automatisierungen ansehen",
      "to": "/automations"
    },
    "status": [
      {
        "label": "Automation OS",
        "registryId": "automation-n8n"
      }
    ],
    "stageTag": "Automation OS · Produktentwurf",
    "stageCaption": "Auslöser → Schritte → Prüfung → Ergebnis",
    "promiseTitle": "Drei Bausteine. Ein kontrollierter Ablauf.",
    "promises": [
      {
        "title": "Auslöser erfassen",
        "body": "Aufgaben werden anhand definierter Ereignisse vorbereitet."
      },
      {
        "title": "Schritte koordinieren",
        "body": "Abläufe und Zuständigkeiten miteinander verbinden."
      },
      {
        "title": "Kontrolliert ausführen",
        "body": "Freigaben und Nachweise vor produktivem Einsatz prüfen."
      }
    ],
    "flow": {
      "eyebrow": "Schritt für Schritt · Beispiel",
      "title": "So könnte es funktionieren.",
      "text": "Die Darstellung zeigt einen geplanten Ablauf, keine freigegebene produktive Ausführung.",
      "panelLabel": "Automation OS · Beispiel",
      "steps": [
        {
          "title": "Auslöser",
          "action": "Ein wiederkehrender Vorgang wird beschrieben.",
          "result": "Ein definierter Workflow-Einstieg liegt vor."
        },
        {
          "title": "Prüfung",
          "action": "Berechtigungen und Bedingungen werden ausgewertet.",
          "result": "Offene Freigaben werden sichtbar."
        },
        {
          "title": "Ablauf",
          "action": "Freigegebene Schritte sollen kontrolliert ausgeführt werden.",
          "result": "Ein nachvollziehbares Zwischenergebnis entsteht."
        },
        {
          "title": "Nachweis",
          "action": "Ergebnis und Fehler werden protokolliert.",
          "result": "Der Ablauf ist später prüfbar."
        }
      ],
      "fine": "Illustrativer Ablauf ohne Verbindung zu einem Kundenkonto oder einem produktiven Workflow."
    },
    "casesTitle": "Geplante Einsatzmöglichkeiten.",
    "cases": [
      {
        "trade": "Handwerk",
        "situation": "Anfragen sollen automatisiert vorsortiert werden.",
        "result": "Vorbereitete Vorgänge statt unkontrollierter Aktionen."
      },
      {
        "trade": "Dienstleistung",
        "situation": "Wiederkehrende Aufgaben sollen weniger Zeit kosten.",
        "result": "Klarer Prozess mit Freigabepunkt."
      },
      {
        "trade": "Teamarbeit",
        "situation": "Übergaben gehen im Alltag verloren.",
        "result": "Zuständigkeiten und Status werden sichtbar."
      }
    ],
    "startSteps": [
      {
        "title": "Workflow auswählen",
        "body": "Anwendungsfall und Auslöser definieren."
      },
      {
        "title": "Berechtigungen prüfen",
        "body": "Schritte und Freigabebedarf festlegen."
      },
      {
        "title": "Preview bewerten",
        "body": "Vor Produktivschaltung technische Prüfung durchführen."
      }
    ],
    "pricingTitle": "Produktstatus und Verfügbarkeit.",
    "pricingMode": "roadmap",
    "limits": "n8n-Laufzeit nur Preview. Der produktive Kunden-End-to-End-Ablauf und ein eigener Checkout sind nicht abgenommen.",
    "cta": {
      "title": "Mehr Möglichkeiten unter einem Dach.",
      "text": "Die geplanten Module nutzen künftig die gemeinsame RealSync-Plattform. Bestehende Governance, Login und Mandantentrennung bleiben erhalten.",
      "primary": {
        "label": "Alle Produkte ansehen",
        "to": "/#produkte"
      },
      "secondary": {
        "label": "Automatisierungen ansehen",
        "to": "/automations"
      }
    },
    "faqs": [
      {
        "q": "Sind n8n-Workflows produktiv ausführbar?",
        "a": "Der n8n-Kanal ist als Preview eingestuft. Eine produktive Ausführung ist nicht nachgewiesen."
      },
      {
        "q": "Kann ich den Dienst separat kaufen?",
        "a": "Ein eigenständiger produktiver Kauf- und Freischaltungsprozess ist nicht abgenommen."
      }
    ]
  },
  "creative-studio": {
    "key": "creative-studio",
    "source": "creative-studio-product",
    "name": "Creative Studio",
    "audience": "Für Bilder, Videos und Content",
    "h1": [
      "Kreativität bündeln.",
      "In einem Workspace."
    ],
    "lead": "Ein geplanter Bereich für die Vorbereitung und Steuerung von Bild-, Video- und Marketing-Workflows mit Governance.",
    "primary": {
      "label": "Geplanten Ablauf ansehen",
      "to": "#ablauf"
    },
    "secondary": {
      "label": "App Builder ansehen",
      "to": "/app-builder"
    },
    "status": [
      {
        "label": "Creative Studio",
        "registryId": "creative-studio"
      }
    ],
    "stageTag": "Creative Studio · Produktentwurf",
    "stageCaption": "Briefing → Entwurf → Review → Veröffentlichung",
    "promiseTitle": "Drei Bausteine. Ein kontrollierter Ablauf.",
    "promises": [
      {
        "title": "Briefing strukturieren",
        "body": "Ziele, Formate und Gestaltung eindeutig festhalten."
      },
      {
        "title": "Varianten planen",
        "body": "Content-Konzepte für unterschiedliche Kanäle vorbereiten."
      },
      {
        "title": "Freigabe sichern",
        "body": "Herkunft, Rechte und Veröffentlichung kontrollieren."
      }
    ],
    "flow": {
      "eyebrow": "Schritt für Schritt · Beispiel",
      "title": "So könnte es funktionieren.",
      "text": "Die Darstellung zeigt einen geplanten Ablauf, keine freigegebene produktive Ausführung.",
      "panelLabel": "Creative Studio · Beispiel",
      "steps": [
        {
          "title": "Idee",
          "action": "Ein Kreativ-Briefing wird vorbereitet.",
          "result": "Anforderungen und gewünschte Formate sind definiert."
        },
        {
          "title": "Entwurf",
          "action": "Ein möglicher Medien-Workflow wird skizziert.",
          "result": "Ein Konzept zur späteren Produktion liegt vor."
        },
        {
          "title": "Prüfung",
          "action": "Inhaltliche und rechtliche Freigaben werden vorgesehen.",
          "result": "Offene Punkte sind dokumentiert."
        },
        {
          "title": "Veröffentlichung",
          "action": "Eine berechtigte Person entscheidet über die Freigabe.",
          "result": "Keine automatische Veröffentlichung ohne Freigabe."
        }
      ],
      "fine": "Illustrativer Ablauf ohne Verbindung zu einem Kundenkonto oder einem produktiven Workflow."
    },
    "casesTitle": "Geplante Einsatzmöglichkeiten.",
    "cases": [
      {
        "trade": "Marketing",
        "situation": "Regelmäßige Inhalte werden vorbereitet.",
        "result": "Ein geplanter Redaktionsablauf."
      },
      {
        "trade": "Produkte",
        "situation": "Produkte sollen verständlicher dargestellt werden.",
        "result": "Ein strukturiertes Bild- oder Videokonzept."
      },
      {
        "trade": "Social Media",
        "situation": "Mehrere Kanäle benötigen passende Inhalte.",
        "result": "Ein vorbereitetes Formatkonzept."
      }
    ],
    "startSteps": [
      {
        "title": "Briefing",
        "body": "Zielgruppe und Format bestimmen."
      },
      {
        "title": "Entwurf",
        "body": "Geplanten Workflow und Varianten prüfen."
      },
      {
        "title": "Freigabe",
        "body": "Rechte und Produktionsstand vor Veröffentlichung prüfen."
      }
    ],
    "pricingTitle": "Produktstatus und Verfügbarkeit.",
    "pricingMode": "roadmap",
    "limits": "Creative Studio ist in Vorbereitung. Keine produktive Bild-/Videogenerierung und kein separater Checkout freigegeben.",
    "cta": {
      "title": "Mehr Möglichkeiten unter einem Dach.",
      "text": "Die geplanten Module nutzen künftig die gemeinsame RealSync-Plattform. Bestehende Governance, Login und Mandantentrennung bleiben erhalten.",
      "primary": {
        "label": "Alle Produkte ansehen",
        "to": "/#produkte"
      },
      "secondary": {
        "label": "App Builder ansehen",
        "to": "/app-builder"
      }
    },
    "faqs": [
      {
        "q": "Kann ich jetzt Videos generieren?",
        "a": "Nein. Der Creative-Studio-Generator ist noch nicht als produktive Kundenfunktion verfügbar."
      },
      {
        "q": "Ist das Teil der RealSync-Plattform?",
        "a": "Ja, als geplantes Modul mit gemeinsamer Governance und zentralem Kundenzugang."
      }
    ]
  }
} as const satisfies Record<'software-factory' | 'automation-os' | 'creative-studio', ProductLandingContent>;
