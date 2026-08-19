# Verwaiste Views — Bestandsaufnahme 2026-08-19

Zwölf View-Dateien in `src/features`, `src/pages` und `src/unified-entry` werden
von **keiner anderen Datei importiert**. Kein Route-Eintrag, kein Link, kein
Einstiegspunkt — rund 115 KB Code, den niemand erreichen kann.

Erhoben über alle 237 Dateien, deren Name auf `View`, `Page`, `Dashboard`,
`Hub`, `Cockpit` oder `Workspace` endet; als verwaist gilt, wer im gesamten
`src/`-Baum außerhalb der eigenen Datei nicht vorkommt.

## Es gibt bereits einen Wächter — mit blindem Fleck

`test/routing/pages-reachable.test.ts` prüft dieselbe Frage, und zwar sauberer
als eine Namenssuche: Er folgt ab `src/main.tsx` den echten relativen Importen
und beantwortet damit „ist die Datei Teil der Anwendung?".

Sein Blickfeld ist aber auf zwei Verzeichnisse begrenzt:

```ts
const PAGE_DIRS = ['src/pages', 'src/unified-entry/pages'];
```

**`src/features` steht nicht darin** — und genau dort liegen die acht großen
Waisen dieser Liste. Der Wächter hat sie nie gesehen, weil er nicht hinsieht.

`PAGE_DIRS` um `src/features` zu erweitern, ist der naheliegende Schluss, aber
erst *nach* der Entscheidung unten: Vorher würde der Test sofort auf allen acht
fehlschlagen, und die einzige Möglichkeit, ihn grün zu bekommen, wäre ein
`KNOWN_UNREACHABLE`-Eintrag je Datei — also die Waisen festzuschreiben statt
sie aufzulösen.

## Warum das kein reines Aufräumthema ist

Drei der acht Tabellen, die das Frontend abfragt und die es in Produktion nicht
gibt, werden **ausschließlich von diesen unerreichbaren Views** benutzt:

| Tabelle | einziger Aufrufer | erreichbar? |
|---|---|---|
| `workspace_members` | `TeamManagementView` | nein |
| `compliance_snapshots` | `ComplianceTrendsDashboard` | nein |
| `compliance_audit_log` | `useAuditTrail` → `ComplianceTrendsDashboard` | nein |

Für diese drei lautet die Frage also nicht „Schema nachziehen oder Frontend
umbiegen". Beides würde Backend für Funktionen bauen, die es bereits gibt.

## Die Waisen haben lebende Gegenstücke

| Verwaist | Bereits erreichbar unter |
|---|---|
| `TeamManagementView` | `/app/team` · `/app/settings/team` · `/app/admin/members` · `/app/governance/team-collaboration` |
| `ApiKeysView` | `/app/keys` · `/app/admin/api-keys` · `/app/governance/api-keys` |
| `WebhookConfigView` | `/app/webhooks` · `/app/api/webhook-retry` · `/app/api/webhook-tester` |
| `AgentsView` | `/app/agents` · `/app/ai-systems/agents` |
| `IntegrationMarketplaceView` | `/app/connectors` · `/app/governance/integrations` |
| `AdvancedBulkScannerView` | `/app/bulk` · `/app/governance/bulk-operations` |
| `ComplianceTrendsDashboard` | `/app/analytics` · `/app/governance/compliance-analytics` |

Ohne erkennbares Gegenstück: `AssetsView`, `UnknownTrackersView`,
`OAuth2ConfigView`.

## Der architektonische Unterschied

Die verwaisten Views fragen ihre Tabellen **direkt aus dem Browser** ab
(`supabase.from('...')`). Ihre lebenden Gegenstücke gehen über Edge Functions.
Das ist genau die Trennung aus CLAUDE.md §2:

> Frontend (SPA) → Edge Functions / Service-APIs → Services → PostgreSQL
> Der Browser spricht **nie** direkt mit privilegierten Ressourcen.

Die Waisen sind also nicht nur Zweitimplementierungen, sondern
Zweitimplementierungen auf einem abgelösten Zugriffsmuster. Sie zu verlinken
hieße, dieses Muster wieder in Betrieb zu nehmen.

## Empfehlung

**Löschen statt verlinken** — für die sieben mit Gegenstück. Die Git-History
bleibt als Archiv; §9 deckt das Entfernen erledigter Arbeit ausdrücklich.

**Vorher prüfen** — bei `AssetsView`, `UnknownTrackersView` und
`OAuth2ConfigView`: Hier fehlt das Gegenstück. Entweder gibt es eines unter
anderem Namen, oder es sind tatsächlich fertige Features ohne Route. Nur im
zweiten Fall ist Verlinken die richtige Antwort — und dann mit Umbau auf
Edge Functions, nicht mit dem vorhandenen Direktzugriff.

**Nicht bauen** — die Schemas für `workspace_members`, `compliance_snapshots`
und `compliance_audit_log`. Sie hätten keinen erreichbaren Nutzer.

## Nächster Schritt nach der Entscheidung

Sind die neun Waisen gelöscht oder verlinkt, gehört `PAGE_DIRS` in
`pages-reachable.test.ts` um `src/features` erweitert. Dann deckt der Wächter
auch den Bereich ab, in dem das Problem entstanden ist, und der nächste Fall
fällt beim Testlauf auf statt bei einer Stichprobe.

## Bereits erledigt

`TransformationPreviewPage.tsx` und `WowPreviewPage.tsx` sind entfernt: je fünf
Zeilen, die nur eine andere Seite re-exportierten, ohne selbst irgendwo
eingebunden zu sein. Die Ziele (`WowPreviewEntryPage`, `PreviewSelectionPage`)
sind unverändert erreichbar.
