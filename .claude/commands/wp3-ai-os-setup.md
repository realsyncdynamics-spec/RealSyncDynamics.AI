---
description: WP3 AI-OS-Setup in Governance Activation (ohne Migration)
---

# WP3 — AI-OS-Setup in Governance Activation

**Voraussetzung:** E-F2 = `/app/activation` · **Branch:** `feat/wp3-activation-ai-setup`

## Rahmen (gilt für jede WP-Session)

Repository: realsyncdynamics-spec/RealSyncDynamics.AI
Lies zuerst: CLAUDE.md, .claude/os-funnel/PLAN.md (§1 Ist-Befund, §5 Leitplanken).

Ein Arbeitspaket pro Session. Eigener Branch von origin/main. Ein PR, Squash.

Verboten ohne separates GO:
- Deploy, Merge, Push auf main
- Supabase-Migration, Stripe-Änderung, Cloudflare/Worker/KV
- echte Provider- oder Agentenaktionen

Immer:
- Tenant nur über JWT user → memberships → tenant_id. Nie aus URL, Body, localStorage.
- Keine Service-Role im Browser.
- Keine Fake-KPIs. Fehlt eine Quelle: Empty State oder Preview-Label.
- Status nur aus src/product/implementation-status.ts: live · preview · coming-soon.
- Keine Claims „vollständig revisionssicher", „autonome Agenten live", „EU-konform garantiert".
- Design-Freeze auf /: keine Tokens umstylen.
- Nur die im WP genannten Dateien ändern. Keine Repo-weiten Refactors.

Prüfung: npm run lint · npm test (betroffene Suites). Nicht ausführbar → im PR begründen.

PR-Text: geänderte Dateien · wiederverwendete Strukturen · live · preview · coming soon · Checks.

## Auftrag

Ziel: Das erste Setup fragt KI-Systeme, Bots/Agenten, Daten und Freigaben ab und
endet mit „Ihr AI Governance Workspace ist vorbereitet." — in der bestehenden
Governance Activation, keine vierte Einrichtungsstrecke.

Bestand:
- src/features/activation/GovernanceActivationView.tsx
  WizardStep = organization | scope | blueprint | documents | review | status
- src/features/activation/activationApi.ts
  Tabelle governance_activations: organization JSONB (ohne Constraint),
  scopes TEXT[], status CHECK (draft|scope_set|org_saved|activated)
- docs/product/governance-activation.md („Not onboarding. Not a setup wizard.")

Persistenz OHNE Migration:
- Neues Feld organization.aiSetup (JSONB-Unterobjekt):
  {
    responsibleRole: string,
    aiSystems:  string[],   // openai, anthropic, google, microsoft_copilot, xai, local, custom, automation_make_zapier_n8n, none
    botsAgents: string[],   // website_chat, voice, whatsapp, browser_agent, builder_agent, support_agent, sales_agent, compliance_agent, none
    dataClasses: string[],  // customer, employee, health, payment, web_tracking, crm, email, internal_docs, process_knowledge
    approvals: {
      autoCommunicate: 'no' | 'with_approval' | 'yes',
      readCustomerData: 'no' | 'with_approval' | 'yes',
      triggerTransactions: 'no' | 'with_approval' | 'yes',
      logEveryAgentAction: boolean,
      humanApprovalFor: string[]
    }
  }
- asOrganization() um einen toleranten aiSetup-Parser erweitern.
- ACHTUNG Überschreibung: saveGovernanceActivation upsertet organization komplett.
  Beim Speichern von Org-Feldern muss aiSetup erhalten bleiben (merge vor upsert)
  — Regressionstest dafür schreiben.
- Enums als Konstanten in einer Datei (z. B. src/features/activation/aiSetupCatalog.ts),
  Labels auf Deutsch dort. Keine Duplikate in Komponenten.

UI:
- Schritt „scope" um drei Unterabschnitte ergänzen ODER einen Schritt
  „ai-inventory" zwischen scope und blueprint einfügen — kleinere Variante wählen
  und im PR begründen.
- „none"-Optionen schließen die anderen Checkboxen aus.
- Browser- und Builder-Agent: fester Hinweis „veröffentlicht, sendet Formulare,
  kauft oder überträgt Kundendaten nie ohne Freigabe".
- Ergebnis im Schritt „status": Zusammenfassung (KI-Systeme erfasst · Bots/Agenten
  vorbereitet · Datenklassen erkannt · Freigaben definiert · Evidence/Audit als
  nächster Schritt) + Button „Zum Governance Command Center" → /app/dashboard.
- Werte werden NICHT als Risikobewertung ausgegeben (keine erfundenen Scores).

Nicht tun: Migration, neues status-Enum, PostRegisterOnboardingPage erweitern,
save-company-profile ändern.

Akzeptanz:
- Setup speichert und lädt aiSetup tenant-gebunden (RLS unverändert)
- Org-Speichern löscht aiSetup nicht (Test)
- Ergebnis-Screen wie oben, Link auf /app/dashboard
- npm run lint, npm test grün
