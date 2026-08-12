# Control Plane Implementation

The canonical `/app/dashboard` experience is the RealSyncDynamics AI Control Plane.

## Architecture

The dashboard is a presentation layer over existing tenant-backed Governance, SiteOS, billing and workflow services. It does not introduce a parallel runtime or mock governance data source.

## Primary surfaces

- AI Command Surface
- Website Builder
- Governance AI / AI Act assessment
- Risk and remediation workflows
- Evidence and compliance KPIs
- Recent governance activity
- Guided Workflows

## Data contract

The dashboard reads existing tenant-scoped `compliance_score_history`, `risk_dashboard_summary`, `dashboard_insights` and `dashboard_kpis` data.
