// Agent Tools — Tool catalogue + dispatcher for the conversational
// governance agent (`governance-agent` Edge Function).
//
// Tools are thin wrappers around existing governance-* Edge Functions
// and direct DB reads. The agent never duplicates business logic —
// every mutating tool routes through its canonical Edge Function so
// the tenant-membership guards, audit log, and RLS policies all stay
// in one place.

import type Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';

export const SYSTEM_PROMPT = `Du bist der KI-Compliance-Assistent von RealSyncDynamics.AI — einer EU-konformen Plattform für Continuous AI- und Privacy-Governance.

ROLLE
Du hilfst Tenant-Admins und DPOs bei AI-Assets, Vendoren, DPIAs, Incidents und Telemetrie. Eigenständige Lese-Operationen erlaubt; Mutationen nur über Tools, niemals per Aussage.

LEITPLANKEN
1. Keine individuelle Rechtsberatung; bei konkreten Rechtsfragen Fachanwalt/DSB nennen.
2. Technische Risikoanalyse von rechtlicher Beurteilung trennen.
3. Bei Regulierungs-Verweis konkreten Artikel nennen (DSGVO / TTDSG / AI Act).
4. Keine Aussagen ohne Tool-Output-Beleg. Fehlt die Datenlage: sagen + nächstes Tool nennen.
5. Bei Unsicherheit oder über Tool-Umfang hinaus: \`escalate_to_human\` anbieten.

STIL
Direkt, knapp, handlungsorientiert. Keine Marketing-Floskeln. Bei Tool-Ergebnissen Zahl statt "viele", per ID verlinken. Hohes Risiko → erster Satz.

HINWEIS
Du bist selbst AI-System unter AI-Act-Geltung. Outputs landen in \`agent_runs\` und \`governance_admin_audit_log\`. Jede Aktion ist auditierbar.`;

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_assets',
    description:
      'Listet AI-Assets des aktuellen Tenants (Websites, AI-Systeme, Vendoren, Modelle, Agents, APIs, Datasets, Repositories, Workflows). Filter optional nach asset_type oder ai_act_class.',
    input_schema: {
      type: 'object',
      properties: {
        asset_type: { type: 'string', enum: ['website', 'ai_system', 'vendor', 'model', 'agent', 'api', 'dataset', 'repository', 'workflow'] },
        ai_act_class: { type: 'string', enum: ['minimal', 'limited', 'high', 'prohibited', 'unknown'] },
        limit: { type: 'integer', default: 50 },
      },
    },
  },
  {
    name: 'get_risk_summary',
    description:
      'Aggregierte Risiko-Übersicht über alle Assets des aktuellen Tenants. Liefert High-/Critical-Counts und die Top-10 nach Risk-Score (aus asset_risk_history).',
    input_schema: {
      type: 'object',
      properties: {
        severity_filter: { type: 'string', enum: ['all', 'critical', 'high', 'medium', 'low'], default: 'all' },
      },
    },
  },
  {
    name: 'list_dpias',
    description:
      'Listet die DPIAs des Tenants. Filter optional nach status (draft / in_review / approved / rejected) oder asset_id.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'in_review', 'approved', 'rejected'] },
        asset_id: { type: 'string' },
      },
    },
  },
  {
    name: 'list_incidents',
    description:
      'Listet offene und kürzlich geschlossene Incidents. Hochrisiko-Incidents zeigen die verbleibende Restzeit bis zur 72h-Meldepflicht (Art. 33 GDPR).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'investigating', 'contained', 'resolved', 'reported'] },
        limit: { type: 'integer', default: 20 },
      },
    },
  },
  {
    name: 'list_vendors',
    description:
      'Listet Vendoren und deren DPA-Status. Surfacet Vendoren ohne signed DPA oder mit auslaufender Frist.',
    input_schema: {
      type: 'object',
      properties: {
        dpa_status: { type: 'string', enum: ['none', 'requested', 'signed', 'expired', 'not_required'] },
      },
    },
  },
  {
    name: 'get_regulation_info',
    description:
      'Kurze technische Zusammenfassung zu einem Artikel aus DSGVO, TTDSG oder EU AI Act. KEINE Rechtsberatung.',
    input_schema: {
      type: 'object',
      properties: {
        regulation: { type: 'string', enum: ['dsgvo', 'ttdsg', 'ai_act'] },
        article: { type: 'string', description: "z.B. 'Art. 6', '§25', 'Art. 50'" },
      },
      required: ['regulation', 'article'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Erstellt einen Eskalations-Eintrag im Audit-Log. Nutze dies, wenn das Anliegen Rechtsberatung erfordert oder eine destruktive Aktion ohne Tool-Coverage gewünscht ist.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Grund der Eskalation' },
        priority: { type: 'string', enum: ['normal', 'high', 'urgent'], default: 'normal' },
        summary: { type: 'string', description: 'Was bisher in der Konversation diskutiert wurde' },
      },
      required: ['reason'],
    },
  },
];

const KNOWN_TOOLS = new Set(AGENT_TOOLS.map((t) => t.name));

export interface DispatchCtx {
  name: string;
  input: Record<string, unknown>;
  // deno-lint-ignore no-explicit-any
  admin: any;
  bearerAuth: string;
  tenantId: string;
  userId: string;
  userEmail: string | null;
}

export async function dispatchTool(ctx: DispatchCtx): Promise<unknown> {
  if (!KNOWN_TOOLS.has(ctx.name)) {
    return { error: `unknown tool: ${ctx.name}` };
  }
  try {
    switch (ctx.name) {
      case 'list_assets':         return await toolListAssets(ctx);
      case 'get_risk_summary':    return await toolRiskSummary(ctx);
      case 'list_dpias':          return await toolListDpias(ctx);
      case 'list_incidents':      return await toolListIncidents(ctx);
      case 'list_vendors':        return await toolListVendors(ctx);
      case 'get_regulation_info': return toolRegulationInfo(ctx);
      case 'escalate_to_human':   return await toolEscalate(ctx);
      default:                    return { error: `tool not implemented: ${ctx.name}` };
    }
  } catch (e) {
    return { error: (e as Error).message, tool: ctx.name };
  }
}

async function toolListAssets(ctx: DispatchCtx): Promise<unknown> {
  let q = ctx.admin.from('governance_assets')
    .select('id, name, asset_type, ai_act_class, risk_score, status, environment, created_at')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(Math.min((ctx.input.limit as number | undefined) ?? 50, 200));
  if (ctx.input.asset_type)   q = q.eq('asset_type', ctx.input.asset_type);
  if (ctx.input.ai_act_class) q = q.eq('ai_act_class', ctx.input.ai_act_class);
  const { data, error } = await q;
  if (error) throw error;
  return { assets: data ?? [], count: data?.length ?? 0 };
}

async function toolRiskSummary(ctx: DispatchCtx): Promise<unknown> {
  const { data: assets } = await ctx.admin.from('governance_assets')
    .select('id, name, asset_type, ai_act_class, risk_score').eq('tenant_id', ctx.tenantId);
  const assetIds = (assets ?? []).map((a: { id: string }) => a.id);
  const { data: latestRisks } = assetIds.length === 0 ? { data: [] } : await ctx.admin.from('asset_risk_history')
    .select('asset_id, risk_score, calculated_at')
    .in('asset_id', assetIds)
    .order('calculated_at', { ascending: false })
    .limit(500);

  const latestByAsset = new Map<string, { risk_score: number; calculated_at: string }>();
  for (const r of (latestRisks ?? []) as Array<{ asset_id: string; risk_score: number; calculated_at: string }>) {
    if (!latestByAsset.has(r.asset_id)) latestByAsset.set(r.asset_id, { risk_score: r.risk_score, calculated_at: r.calculated_at });
  }

  const filter = ctx.input.severity_filter as string ?? 'all';
  const severity = (s: number) => s >= 80 ? 'critical' : s >= 60 ? 'high' : s >= 40 ? 'medium' : 'low';

  const rows = (assets ?? []).map((a: { id: string; name: string; asset_type: string; ai_act_class: string; risk_score: number | null }) => {
    const latest = latestByAsset.get(a.id);
    const score = latest?.risk_score ?? a.risk_score ?? 0;
    return { id: a.id, name: a.name, asset_type: a.asset_type, ai_act_class: a.ai_act_class, score, severity: severity(score) };
  }).filter((r: { severity: string }) => filter === 'all' || r.severity === filter)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, 10);

  const critical = rows.filter((r: { severity: string }) => r.severity === 'critical').length;
  const high     = rows.filter((r: { severity: string }) => r.severity === 'high').length;
  return {
    total_assets: assets?.length ?? 0,
    critical,
    high,
    immediate_action_needed: critical + high > 0,
    top: rows,
  };
}

async function toolListDpias(ctx: DispatchCtx): Promise<unknown> {
  let q = ctx.admin.from('dpias')
    .select('id, title, status, asset_id, dpo_consulted, review_due_at, created_at')
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (ctx.input.status)   q = q.eq('status', ctx.input.status);
  if (ctx.input.asset_id) q = q.eq('asset_id', ctx.input.asset_id);
  const { data, error } = await q;
  if (error) throw error;
  return { dpias: data ?? [], count: data?.length ?? 0 };
}

async function toolListIncidents(ctx: DispatchCtx): Promise<unknown> {
  let q = ctx.admin.from('incidents')
    .select('id, title, severity, status, detected_at, notification_deadline_at, asset_id')
    .eq('tenant_id', ctx.tenantId)
    .order('detected_at', { ascending: false })
    .limit(Math.min((ctx.input.limit as number | undefined) ?? 20, 100));
  if (ctx.input.status) q = q.eq('status', ctx.input.status);
  const { data, error } = await q;
  if (error) throw error;

  const now = Date.now();
  const enriched = (data ?? []).map((i: { id: string; severity: string; status: string; notification_deadline_at: string | null }) => {
    if (!i.notification_deadline_at || i.status === 'reported' || i.status === 'resolved') return i;
    const hoursLeft = Math.max(0, Math.round((new Date(i.notification_deadline_at).getTime() - now) / 36e5));
    return { ...i, hours_until_72h_deadline: hoursLeft };
  });
  return { incidents: enriched, count: enriched.length };
}

async function toolListVendors(ctx: DispatchCtx): Promise<unknown> {
  let q = ctx.admin.from('vendors')
    .select('id, name, country, dpa_status, dpa_expires_at, transfer_mechanism, risk_level')
    .eq('tenant_id', ctx.tenantId)
    .order('name', { ascending: true })
    .limit(200);
  if (ctx.input.dpa_status) q = q.eq('dpa_status', ctx.input.dpa_status);
  const { data, error } = await q;
  if (error) throw error;
  return { vendors: data ?? [], count: data?.length ?? 0 };
}

function toolRegulationInfo(ctx: DispatchCtx): unknown {
  const regulation = ctx.input.regulation as string;
  const article = ctx.input.article as string;
  const kb: Record<string, Record<string, { title: string; core: string; practice: string }>> = {
    dsgvo: {
      'Art. 6': {
        title: 'Rechtmäßigkeit der Verarbeitung',
        core: 'Mind. eine Rechtsgrundlage erforderlich: Einwilligung, Vertrag, rechtliche Verpflichtung, lebenswichtige Interessen, öffentliches Interesse, berechtigte Interessen.',
        practice: 'Für Tracking/Analytics meist Art. 6 Abs. 1 lit. a (Einwilligung).',
      },
      'Art. 25': {
        title: 'Datenschutz durch Technikgestaltung',
        core: 'Technische und organisatorische Maßnahmen zur Datenminimierung bereits bei Entwicklung.',
        practice: 'Kein Tracking ohne Consent-Management-Platform.',
      },
      'Art. 33': {
        title: 'Meldung an die Aufsichtsbehörde',
        core: 'Meldung von Datenschutzverletzungen unverzüglich, möglichst binnen 72 Stunden nach Bekanntwerden.',
        practice: 'Incidents im governance-incidents Tool: `notification_deadline_at` zeigt die Frist.',
      },
      'Art. 35': {
        title: 'Datenschutz-Folgenabschätzung',
        core: 'Bei voraussichtlich hohem Risiko für die Rechte und Freiheiten natürlicher Personen erforderlich.',
        practice: 'DPIA-Tool für jeden Asset mit ai_act_class=high anlegen.',
      },
    },
    ttdsg: {
      '§25': {
        title: 'Schutz der Privatsphäre bei Endeinrichtungen',
        core: 'Informationsspeicherung und -abruf auf Endgeräten nur mit Einwilligung. Ausnahmen: technisch notwendige Cookies.',
        practice: 'Gilt für Cookies, LocalStorage, Fingerprinting — die Extension misst genau dies.',
      },
    },
    ai_act: {
      'Art. 6': {
        title: 'Klassifizierung als Hochrisiko-KI-System',
        core: 'Bestimmt, ob ein AI-System unter Annex III fällt (Hochrisiko).',
        practice: 'Wird vom ai-act-classify Service vorgeschlagen, im Asset als ai_act_class hinterlegt.',
      },
      'Art. 13': {
        title: 'Transparenz und Bereitstellung von Informationen',
        core: 'Hochrisiko-KI-Systeme müssen ausreichend transparent betrieben werden.',
        practice: 'Deployment-Manifest muss transparency_notice_url enthalten (Blueprint §5.2).',
      },
      'Art. 50': {
        title: 'Transparenzpflichten für bestimmte KI-Systeme',
        core: 'KI-generierte Inhalte müssen gekennzeichnet werden. Chatbots müssen offenlegen, dass mit KI interagiert wird.',
        practice: 'Anwendbar ab 2. August 2026 — relevant für jeden Chatbot-Deploy.',
      },
    },
  };
  const info = kb[regulation]?.[article];
  if (!info) {
    return {
      regulation: regulation.toUpperCase(),
      article,
      notice: `Keine gespeicherte Zusammenfassung für ${article} (${regulation.toUpperCase()}). Bitte offizielle Quelle konsultieren.`,
      sources: ['https://dsgvo-gesetz.de', 'https://eur-lex.europa.eu'],
    };
  }
  return { regulation: regulation.toUpperCase(), article, ...info, disclaimer: 'Technische Zusammenfassung, keine Rechtsberatung.' };
}

async function toolEscalate(ctx: DispatchCtx): Promise<unknown> {
  const ticketId = crypto.randomUUID();
  await ctx.admin.from('governance_admin_log').insert({
    tenant_id: ctx.tenantId,
    actor_user_id: ctx.userId,
    actor_email: ctx.userEmail,
    action: 'agent.escalation',
    target_type: 'support_ticket',
    target_id: ticketId,
    payload: {
      reason: ctx.input.reason,
      priority: ctx.input.priority ?? 'normal',
      summary: (ctx.input.summary as string ?? '').slice(0, 2000),
    },
  });
  return {
    ticket_id: ticketId,
    status: 'created',
    priority: ctx.input.priority ?? 'normal',
    sla: ctx.input.priority === 'urgent' ? '< 1h' : '< 4h',
    note: 'Eskalation im governance_admin_log persistiert. Notification-Pfad wird in einer Folge-PR an Slack/E-Mail gewired.',
  };
}
