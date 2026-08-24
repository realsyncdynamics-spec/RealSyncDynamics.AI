# Kanonisches Entitlement-Vokabular (AP1)

**Stand: 2026-08-24.** Umgesetzt und gegen eine echte PostgreSQL geprüft.

Seit diesem Schritt gibt es **einen** Namensraum für die Frage
„Was darf dieser Kunde?":

```
Paket ┐
Add-on┼──→  Entitlement-Key  ──→  Runtime-Autorisierung  ──→  Oberfläche
Grant ┘
```

Vorher standen drei nebeneinander — `ModuleId` (in `unlocks` und
`plan.modules`), `addon_id` und die Entitlement-Keys der Datenbank. Keiner war
maßgeblich: Autorisiert hat immer die Datenbank, angezeigt wurde nach
`plan.modules`.

---

## 1. Die fehlenden Keys — geplant acht, nötig fünf

Der Implementierungsplan nannte acht neue Keys. Die Messung gegen den
vollständigen Migrationsstand hat **drei davon als Dubletten entlarvt, bevor
sie entstanden**:

| Geplanter Key | Tatsächlich vorhanden | Seit |
|---|---|---|
| `channel.whatsapp` | **`bots.whatsapp`** | `20260826000000_whatsapp_channel` (kam mit `main` #1131) |
| `bots.website_chat` | **`bots.chat`** | `20260628193759_bots_entitlements` |
| `booking.enabled` | **`bots.appointments`** | `20260628193759_bots_entitlements` |

Diese drei werden weiterverwendet. Übrig bleiben fünf Fähigkeiten, die
tatsächlich keinen Key hatten.

### Die fünf neuen Keys

| Key | Bedeutung | Ersetzt `ModuleId` | Verwendet von | Pläne | Migration nötig |
|---|---|---|---|---|---|
| `bots.human_handoff` | Übergabe an einen Menschen mit Eskalationsstufen | `human_handoff` | `voice_bot` | Agency, Enterprise, Partner | nur Anlage + Zuordnung, keine Datenmigration |
| `bots.multi_channel` | Ein Bot über mehrere Kanäle mit einem Prüfpfad | `multi_channel_messaging` | `whatsapp_bot`, `additional_company` | Growth, Agency, Enterprise, Partner | dito |
| `policy.nis2` | NIS2 als Rahmenwerk | `nis2` | `advanced_ai_governance` | Agency, Enterprise, Partner | dito |
| `policy.iso27001` | ISO 27001 als Rahmenwerk | `iso_27001` | `advanced_ai_governance` | Growth, Agency, Enterprise, Partner | dito |
| `governance.risk_register` | Risikoregister mit Eigentümern und Maßnahmenverfolgung | `risk_register` | `advanced_ai_governance` | Growth, Agency, Enterprise, Partner | dito |

**Warum die Plan-Zuordnung keine Produktänderung ist:** Jeder neue Key erbt
genau die Pläne, deren `plan.modules` die bisherige `ModuleId` bereits
enthielt. Der Plan sagte diese Fähigkeit also schon zu — sie stand nur an
einer Stelle, die zur Laufzeit niemand fragt.

### Vollständige Abbildung `unlocks` → Entitlement-Keys

| Modul | vorher (`ModuleId`) | nachher (`EntitlementKey`) |
|---|---|---|
| `governance_core` | `dsgvo`, `eu_ai_act`, `policy_engine`, `evidence_vault`, `audit_center`, `monitoring`, `compliance_reports`, `alerts` | `governance.dsgvo_directory`, `governance.ai_register`, `policy.packs`, `evidence.basic_vault`, `website.scan`, `monitoring.monthly`, `compliance.export`, `alerts.email` |
| `website_chat` | `website_chat`, `ai_bots` | `bots.chat`, `bots.enabled` |
| `voice_bot` | `voice`, `ai_bots`, `human_handoff` | `bots.voice`, `bots.enabled`, **`bots.human_handoff`** |
| `whatsapp_bot` | `whatsapp`, `ai_bots`, `multi_channel_messaging` | `bots.whatsapp`, `bots.enabled`, **`bots.multi_channel`** |
| `booking` | *(leer)* | `bots.appointments` |
| `advanced_ai_governance` | `nis2`, `iso_27001`, `risk_register`, `remediation`, `drift_detection` | **`policy.nis2`**, **`policy.iso27001`**, **`governance.risk_register`**, `fix.snippets`, `monitoring.drift` |
| `additional_company` | `multi_channel_messaging` | **`bots.multi_channel`** |
| `ai_frontend`, `additional_domain` | *(leer)* | *(leer)* — Dienstleistung bzw. Mengenposten, kein Berechtigungsschalter |

Deprecated sind damit als Freischaltungs-Vokabular: `dsgvo`, `eu_ai_act`,
`policy_engine`, `evidence_vault`, `audit_center`, `monitoring`,
`compliance_reports`, `alerts`, `ai_bots`, `website_chat`, `voice`,
`whatsapp`, `human_handoff`, `multi_channel_messaging`, `nis2`, `iso_27001`,
`risk_register`, `remediation`, `drift_detection`.

`plan.modules` selbst **bleibt** — es trägt die Feature-Listen der Preisseite.
Es entscheidet nur nicht mehr über Zugriff.

---

## 2. Drei Widersprüche, die dabei sichtbar wurden

Das Verhalten des Marketplace wurde vor und nach der Umstellung an 63 Punkten
verglichen (jedes Modul × jeder Plan, plus „günstigster Plan"). **Neun Punkte
haben sich geändert — alle drei Fälle sind Korrekturen**, weil die alte
Antwort aus `plan.modules` kam und die Datenbank etwas anderes sagte:

| Modul | vorher | nachher | Ursache |
|---|---|---|---|
| `governance_core` | ab **Growth** | ab **Agency** | `policy.packs` liegt real nicht auf Growth. Genau die Lücke, die der Eigentümer für AP2 zur Behebung freigegeben hat. |
| `website_chat` | ab **Starter** | ab **Growth** | `bots.enabled` liegt real nicht auf Starter — `plan.modules` behauptete `ai_bots`. |
| `booking` | **nie** aktiv | ab **Growth** | Das Modul hatte `unlocks: []` und konnte deshalb nie aktiv werden, obwohl `bots.appointments` seit Juni existiert und Growth es trägt. Falsch negativ. |

Die ersten beiden Fälle sind der Grund, warum es AP1 gab: Die Oberfläche
versprach etwas anderes, als der Server zuließ.

---

## 3. Was ausdrücklich **nicht** angetastet wurde

**`FEATURE_RULES` in `src/core/billing/entitlements.ts` bleibt.** Der
Implementierungsplan wollte es entfernen — das wäre falsch gewesen. Es ist
kein `unlocks`-Übersetzer, sondern ein eigenes Vokabular aus 27 `FeatureKey`s,
von denen 15 zwar denselben Namen tragen wie ein Entitlement, aber über einen
anderen Weg aufgelöst werden. Es speist das **Verbrauchsmodell**
(`complianceExportsMonthly` und Kollegen), nicht die Freischaltung; benutzt
wird es allein von `src/core/usage/usage-service.ts`.

> **Regel:** `FEATURE_RULES` beantwortet Kontingentfragen, nicht
> Zugriffsfragen. Es darf nicht in das Entitlement-System gezogen werden.

Ebenfalls unangetastet: `plan.modules`, `plan.permissions`, RLS, die Signatur
von `tenant_entitlements()`, die Mitgliedschaftsprüfung — und **Stripe**. AP1
hat kein Produkt, keinen Preis und keine Checkout-Konfiguration berührt.

---

## 4. Wie die Parität gehalten wird

`PLAN_ENTITLEMENTS` in `shared/pricing.ts` spiegelt den Stand **nach allen
Migrationen**. Damit das so bleibt, gibt es zwei Netze:

| Netz | Was es prüft | Läuft |
|---|---|---|
| `test/billing/entitlement-vocabulary.test.ts` | Jeder Key der Quelle wird von einer Migration angelegt; `unlocks` nennen nur bekannte Keys; keine `ModuleId` mehr; das gemessene Marketplace-Verhalten | in CI, ohne Datenbank |
| `npm run check:entitlements` | Key für Key und Wert für Wert gegen eine echte Datenbank, in **beide** Richtungen | lokal oder mit Supabase-Zugangsdaten |

Der Test ist mutationsgeprüft: Ein erfundener Key in `ENTITLEMENT_KEYS` lässt
ihn fallen.

Die Paritätsprüfung gegen die migrierte Datenbank ergab **null Differenzen**:

```
Plan                 Quelle    DB   Differenzen
─────────────────────────────────────────────────
agency                   55    55   —
enterprise               59    59   —
free_audit                9     9   —
governance_launch        16    16   —
growth                   38    38   —
partner                  57    57   —
starter                  18    18   —
```

Die Legacy-Leiter (`bronze`, `silver`, `gold`, `enterprise_public`) sowie
`free` und `free_tier` erscheinen als Hinweis, nicht als Fehler — sie sind
bewusst nicht Teil des Verkaufsmodells (Entscheidung vom 2026-08-24:
stilllegen, nicht löschen).

---

## 5. Was daraus für die Arbeitsweise folgt

Dreimal in Folge hat eine Messung einen geplanten Schritt widerlegt, bevor er
Schaden anrichten konnte: `channel.whatsapp` wäre eine Dublette geworden,
`FEATURE_RULES` wäre fälschlich gelöscht worden, und `bots.chat` sowie
`bots.appointments` existierten längst. Alle drei standen im Plan als
gesicherte Annahme.

**Regel:** Vor jedem neuen Entitlement-Key erst gegen den vollständigen
Migrationsstand prüfen, ob er schon existiert — nicht gegen die Live-Datenbank
und nicht gegen das Gedächtnis.
