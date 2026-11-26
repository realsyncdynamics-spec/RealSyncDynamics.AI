---
description: REA-Radar — Werkzeuge und Wettbewerber (Replit, Google AI Studio, Bolt, Voice, WhatsApp) analysieren und den Radar-Bericht als Draft-PR aktualisieren
argument-hint: [optionaler Schwerpunkt, z. B. "WhatsApp Calling" oder "Wettbewerb Handwerk"]
---

Übergib an den Subagenten `rea` (`.claude/agents/rea.md`) im **Modus Radar**:

1. Methode `docs/rea/RADAR_METHODE.md` und letzten Bericht `docs/rea/RADAR_BERICHT.md` lesen.
2. Änderungen seit dem letzten Lauf recherchieren (Primärquellen zuerst).
   Schwerpunkt dieses Laufs: $ARGUMENTS
3. Bericht ersetzen, Verlaufszeile ergänzen, höchstens 3 bewertete Arbeitspakete.
4. `npm run check:context` ausführen, Draft-PR `docs(rea): Radar <Datum>` öffnen.

Nur Bericht und Vorschläge: keine Änderungen an Preisen, Claims, Produktion oder Diensten.
