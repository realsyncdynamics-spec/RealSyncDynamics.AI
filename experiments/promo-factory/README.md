# RealSync PROMO Factory — isolierter Pilot (Phase 1)

**Status:** Entwurf. Keine Verbindung zu produktiven Konten, Website, Supabase oder Publishing-Diensten.

## Ziel
Einen kleinen, überprüfbaren Planungsprozess mit einem Director und drei Spezialagenten (Market Research, Creative, Growth) demonstrieren. Keine reale Lead-Erfassung, E-Mails, kostenpflichtige Video-Generierung oder Veröffentlichung.

## Sicherheitsgrenzen
- Ohne Flag `--run-model` läuft **keine** Modellinferenz; nur eine statische Planungs-Vorschau.
- Der Agent besitzt **keine Tools**: kein Web, keine Shell, kein GitHub, keine Datei-/Netzwerkaktionen über Agent-Tools.
- Für `--run-model` muss `PROMO_MODEL_APPROVED=1` explizit gesetzt sein. Ein Hugging Face Inference-Zugang und dessen mögliche Kosten sind separat zu prüfen.
- Für Produktion: Tool-Allowlist, echte Sandbox, Mandantenisolation, serverseitige Freigaben, Kostenreservierung, Rate-Limits, Logs, PII-Filter und Evaluierung fehlen noch.
- Kein Merge/Deploy/Workflow- oder Datenbankschema-Change in diesem PR.

## Start
```sh
python3 experiments/promo-factory/pilot.py
python3 -m unittest discover -s experiments/promo-factory/tests -v

# nur nach expliziter Zustimmung zu den Modellkosten, in einer isolierten Umgebung:
# python3 -m pip install -r experiments/promo-factory/requirements.txt
# PROMO_MODEL_APPROVED=1 python3 experiments/promo-factory/pilot.py --run-model
```

Hinweis: Die Projektregel in CLAUDE.md untersagt Agenten eigenständiges `npm install`. Dependencies werden nicht automatisch installiert.

## Folge-PRs (getrennt)
1. Lead-Funnel inklusive idempotenter E-Mail-Outbox und Testzustellung.
2. Berechtigungsgeprüfte CRM-/Kampagnen-Schnittstellen.
3. Kreativ- und Video-Anbindungen mit Budgetreservierung.
4. Dashboard, Freigaben und messbare Kampagnenanalyse.
