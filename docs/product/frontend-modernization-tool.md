# Frontend Modernization Tool (Enterprise+)

Schema: migration `20260924000000_frontend_modernization_tool.sql` (`fmt_*` tables).

Product track: `modernize_frontend` (`shared/pricing.ts`). Entitlement key: `frontend.modernization` (enterprise + partner).

Wizard steps map to `fmt_projects.wizard_step` 1–6 → source_sites → site_scans → content_blocks → frontend_blueprints → bot_configs → publish_jobs (+ governance_events).

Not SiteOS (`siteos_blueprints`) and not `app_builder_projects`.
