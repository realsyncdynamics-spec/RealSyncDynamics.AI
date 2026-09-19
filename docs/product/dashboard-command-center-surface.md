# /app/dashboard surface

Production Command Center. Not a second frontend.

## First paint

1. Mandant — header in `ComplianceStatusView`
2. Lage — four KPI cards (empty = dash, no fake scores)
3. Jetzt — existing empty-tenant CTA / bootstrap rail
4. Ausführen — `DashboardExecuteStrip` → `/app/agents`

Entry: `DashboardRouter` → `CommandCenterDashboard` → `ComplianceStatusView`.

## Off this route

- `AgentOsPanel` (mesh, coming-soon, intent theater)
- `DashboardControlPlane` (bots / builder / SiteOS)

Those components stay in the repo. Agent OS is not deleted. Follow-up: mount the panel on `/app/agents` without putting coming-soon cards on first paint.

## Out of scope

- Nav chrome rewrite (three rows in `GovernanceBrowserShell`)
- Token workbench (#1431)
- Policy Worker / KV
