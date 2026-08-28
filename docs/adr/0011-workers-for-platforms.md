# ADR 0011 — Workers for Platforms (Entwurf)

Status: proposed  
Datum: 2026-08-28

## Kontext

Der Web-App-Builder und der Workstore sollen kundenseitig oder KI-generierten
Code isoliert ausführen. Cloudflare Workers for Platforms ist der Kandidat.

## Entscheidung

Nicht in diesem PR implementieren. Isolation bleibt über bestehende Tenancy
(RLS, getrennte Worker-Deployments). Ein Spike folgt, bevor Kunden-Code auf
der Edge läuft.

## Konsequenzen

- R2-Adapter darf vorbereitet werden (`AssetStore`), ohne WfP.
- Kein Multi-Tenant-Worker-Dispatch ohne eigenen Sicherheitsreview.
