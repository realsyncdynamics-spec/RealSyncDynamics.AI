# /app/dashboard first paint

Canonical route stays `ComplianceStatusDashboard`.

1. Mandant — header + status line (`mandant-status-line`)
2. Lage — four KPI cards when data exists
3. Jetzt — empty-tenant CTA (Domain / Audit / Activation)
4. Ausführen — `DashboardExecuteStrip` → `/app/agents`

`AgentOsPanel` and the former AI Control Plane are not mounted here.
Agent OS lives on `/app/agents`. Modules live on `/app/modules`.
