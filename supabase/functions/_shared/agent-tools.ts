// Agent Tools — Tool catalogue + dispatcher for the conversational
// governance agent (`governance-agent` Edge Function).
//
// Tools are thin wrappers around existing governance-* Edge Functions
// and direct DB reads. The agent never duplicates business logic —
// every mutating tool routes through its canonical Edge Function so
// the tenant-membership guards, audit log, and RLS policies all stay
// in one place.

import {
  retrieveLegalContext,
  LegalRetrievalGuardrailError,
  LegalRetrievalPhaseError,
  LEGAL_PLATFORM_DISCLAIMER,
  type LegalFramework,
  type LegalJurisdiction,
} from './legal-retrieval.ts';

interface QueryBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(col: string, val: unknown): QueryBuilder;
  in(col: string, vals: unknown[]): QueryBuilder;
  order(col: string, opts?: Record<string, unknown>): QueryBuilder;
  limit(n: number): QueryBuilder;
}

interface SupabaseAdminClient {
  from(table: string): {
    select(cols: string): QueryBuilder;
    insert(obj: Record<string, unknown>): Promise<{ error: unknown }>;
  };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

// Structural shape of Anthropic.Tool — kept local so vitest (Node-resolver)
// doesn't trip on the 'npm:' specifier used by Deno at runtime. The
// Anthropic SDK accepts plain objects matching this shape; we forward
// the AGENT_TOOLS array into it verbatim.
interface AnthropicToolShape {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const SYSTEM_PROMPT = `Du bist der KI-Compliance-Assistent von RealSyncDynamics.AI — einer EU-konformen Plattform für Continuous AI- und Privacy-Governance.

ROLLE
Du hilfst Tenant-Admins und DPOs dabei, ihre AI-Assets, Vendoren, DPIAs, Incidents und Telemetrie compliant zu halten. Du kannst eigenständig Lese-Operationen ausführen und Mutationen vorschlagen — letztere immer nur über die definierten Tools, niemals durch direkte DB-Aussagen.

LEITPLANKEN
1. Du gibst KEINE individuelle Rechtsberatung. Bei konkreten Rechtsfragen verweise auf einen Fachanwalt oder zertifizierten DSB.
2. Trenne klar zwischen technischer Risikoanalyse (was du kannst) und rechtlicher Beurteilung.
3. Nenne immer den konkreten DSGVO-Artikel, TTDSG-Paragraphen oder AI-Act-Artikel, wenn du auf Regulierung verweist.
4. Verfasse nichts, das du nicht aus den Tool-Outputs belegen kannst. Wenn die Daten fehlen, sage es und nenne das Tool, das du als nächstes aufrufen würdest.
5. Wenn du unsicher bist oder das Anliegen den Tool-Umfang übersteigt, biete \`escalate_to_human\` an.

STIL
- Direkt, knapp, handlungsorientiert. Kein Marketing-Sprech.
- Bei Tool-Ergebnissen: nenne die Zahl, nicht "viele" — und verlinke per ID auf das Objekt.
- Wenn ein Risiko hoch ist, sage es im ersten Satz, dann erst die Details.

WICHTIG: Du bist selbst ein AI-System unter EU-AI-Act-Geltung. Outputs werden zu \`agent_runs\` persistiert und in \`governance_admin_audit_log\` referenziert. Jede deiner Aktionen ist auditierbar.`;

export const AGENT_TOOLS: AnthropicToolShape[] = [
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
    name: 'legal_context',
    description:
      'Source-grounded Compliance-Retrieval: sucht in der internen Wissensbasis ' +
      '(DSGVO, EU AI Act, NIS2, DSA, Data Act, eIDAS, BfDI/EDPB-Leitlinien) nach ' +
      'Passagen, die zu einer Frage passen. Jede Antwort enthält die Quelle ' +
      '(URL + Anker) und den verbindlichen Disclaimer. KEINE Rechtsberatung — ' +
      'Hinweise auf qualifizierten Rechtsbeistand sind im Output Pflicht. ' +
      'Nutze dieses Tool, wenn der Auditor nach „Welche Pflichten betreffen X?" ' +
      'oder „Was sagt die DSGVO zu …?" fragt.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Suchfrage in natürlicher Sprache, z.B. „Einwilligung bei Tracking nach Art. 6"',
        },
        top_k: {
          type: 'integer',
          minimum: 1, maximum: 10,
          description: 'Anzahl der zurückgegebenen Passagen (1-10, default 5)',
        },
        framework: {
          type: 'string',
          enum: ['gdpr', 'ai_act', 'nis2', 'dsa', 'data_act', 'eidas',
                 'ttdsg', 'tmg', 'tdsg', 'c2pa', 'cloud_act',
                 'edpb', 'bfdi', 'cnil', 'other'],
          description: 'Filtert auf ein einzelnes Regelwerk',
        },
        jurisdiction: {
          type: 'string',
          enum: ['eu', 'de', 'at', 'ch', 'fr', 'us', 'uk', 'other'],
          description: 'Filtert auf eine Jurisdiktion',
        },
      },
      required: ['query'],
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
  admin: SupabaseAdminClient;
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
      case 'legal_context':       return await toolLegalContext(ctx);
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
  const arr = (data as unknown[]) ?? [];
  return { assets: arr, count: arr.length };
}

async function toolRiskSummary(ctx: DispatchCtx): Promise<unknown> {
  const { data: assets } = await ctx.admin.from('governance_assets')
    .select('id, name, asset_type, ai_act_class, risk_score').eq('tenant_id', ctx.tenantId);
  const assetArr = (assets as Array<{ id: string; name: string; asset_type: string; ai_act_class: string; risk_score: number | null }>) ?? [];
  const assetIds = assetArr.map((a) => a.id);
  const { data: latestRisks } = assetIds.length === 0 ? { data: [] } : await ctx.admin.from('asset_risk_history')
    .select('asset_id, risk_score, calculated_at')
    .in('asset_id', assetIds)
    .order('calculated_at', { ascending: false })
    .limit(500);

  const latestByAsset = new Map<string, { risk_score: number; calculated_at: string }>();
  const risksArr = ((latestRisks as unknown[]) ?? []) as Array<{ asset_id: string; risk_score: number; calculated_at: string }>;
  for (const r of risksArr) {
    if (!latestByAsset.has(r.asset_id)) latestByAsset.set(r.asset_id, { risk_score: r.risk_score, calculated_at: r.calculated_at });
  }

  const filter = ctx.input.severity_filter as string ?? 'all';
  const severity = (s: number) => s >= 80 ? 'critical' : s >= 60 ? 'high' : s >= 40 ? 'medium' : 'low';

  const rows = assetArr.map((a) => {
    const latest = latestByAsset.get(a.id);
    const score = latest?.risk_score ?? a.risk_score ?? 0;
    return { id: a.id, name: a.name, asset_type: a.asset_type, ai_act_class: a.ai_act_class, score, severity: severity(score) };
  }).filter((r) => filter === 'all' || r.severity === filter)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const critical = rows.filter((r: { severity: string }) => r.severity === 'critical').length;
  const high     = rows.filter((r: { severity: string }) => r.severity === 'high').length;
  return {
    total_assets: assetArr.length,
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
  const arr = (data as unknown[]) ?? [];
  return { dpias: arr, count: arr.length };
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
  const dataArr = (data as Array<{ id: string; title: string; severity: string; status: string; detected_at: string; notification_deadline_at: string | null; asset_id: string | null }>) ?? [];
  const enriched = dataArr.map((i) => {
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
  const arr = (data as unknown[]) ?? [];
  return { vendors: arr, count: arr.length };
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

// Pulls source-grounded legal/compliance passages from the internal
// Legal-RAG layer (migration 20260614 + 20260615). Every result is
// returned with its source URL, citation anchor, and disclaimer; the
// platform disclaimer is appended at the top of the envelope. The
// retrieval helper writes a legal_retrieval_log row on every call
// (audit substrate). Failures degrade gracefully so the agent can
// still respond — caller gets a structured error, not an exception.
async function toolLegalContext(ctx: DispatchCtx): Promise<unknown> {
  const query = String(ctx.input.query ?? '').trim();
  if (!query) {
    return {
      error: 'query parameter is required',
      hint:  'Nenne die konkrete Frage in natürlicher Sprache.',
    };
  }
  const top_k = typeof ctx.input.top_k === 'number'
    ? Math.min(Math.max(Math.floor(ctx.input.top_k), 1), 10)
    : 5;

  try {
    const r = await retrieveLegalContext(ctx.admin as unknown as any, {
      query,
      top_k,
      framework:      ctx.input.framework    as LegalFramework    | undefined,
      jurisdiction:   ctx.input.jurisdiction as LegalJurisdiction | undefined,
      caller_type:    'internal',
      caller_ref:     ctx.userId || 'agent',
      correlation_id: null,
    });
    return {
      query:        r.query,
      retrieved_at: r.retrieved_at,
      log_id:       r.log_id,
      platform_disclaimer: LEGAL_PLATFORM_DISCLAIMER,
      results: r.results.map((p) => ({
        title:           p.title,
        framework:       p.framework,
        jurisdiction:    p.jurisdiction,
        heading:         p.heading_path,
        chunk_text:      p.chunk_text,
        source_url:      p.source_url,
        citation_anchor: p.citation_anchor,
        published_at:    p.published_at,
        disclaimer:      p.disclaimer,
        rank_score:      p.rank_score,
      })),
      // Hard reminder for the model — keeps the legal-advice guardrail
      // in the conversation context even if the system prompt drifts.
      note: 'Diese Passagen sind Quellenausschnitte. Beziehe dich beim Antworten ausschließlich auf den zurückgegebenen Text. Keine Aussage ohne mindestens eine source_url. Verweise bei rechtlicher Auslegung auf qualifizierten Rechtsbeistand.',
    };
  } catch (err) {
    if (err instanceof LegalRetrievalPhaseError) {
      return { error: 'legal_context phase mismatch', detail: err.message };
    }
    if (err instanceof LegalRetrievalGuardrailError) {
      return { error: 'legal_context guardrail violation', detail: err.violation };
    }
    return {
      error: 'legal_context retrieval failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
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
