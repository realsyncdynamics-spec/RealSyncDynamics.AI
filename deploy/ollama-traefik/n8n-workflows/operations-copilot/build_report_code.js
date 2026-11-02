// n8n Code node: Run once for all items; no network calls, writes or model invocation.
// Sources are HTTP Request node results with `fullResponse` and `neverError`.
const OWNER = 'realsyncdynamics-spec';
const REPO = 'RealSyncDynamics.AI';
const ROOT = `https://github.com/${OWNER}/${REPO}`;
const generatedAt = new Date().toISOString();
// Defense in depth: text from GitHub and Uptime Kuma is untrusted report content.
// Redact before truncation (truncation must not hide a secret prefix from the filter).
function redact(value) {
  return String(value ?? '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]')
    .replace(/\b(?:github_pat_[A-Za-z0-9_]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|sk_(?:live|test)_[A-Za-z0-9]{8,}|rk_live_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{12,}|uk2_[A-Za-z0-9_-]{12,})\b/g, '[TOKEN REDACTED]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/=-]{8,}/gi, '$1[TOKEN REDACTED]')
    .replace(/\b((?:api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token)\s*[:=]\s*)[\"']?[^\s,;\"']{6,}/gi, '$1[TOKEN REDACTED]')
    // Avoid accidentally emitting credentials in URL query strings.
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s#]+/gi, '$1?[QUERY REDACTED]');
}
const safe = (s, max = 140) => redact(s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[`<>|]/g, '').trim().slice(0, max);
const cleanGitHubRef = (candidate, fallback) => {
  const s = String(candidate ?? '');
  const exact = /^https:\/\/github\.com\/realsyncdynamics-spec\/RealSyncDynamics\.AI\/(?:actions\/runs\/\d+(?:\/job\/\d+)?|pull\/\d+\/checks)\/?$/;
  return exact.test(s) ? s : fallback;
};
const read = (name) => {
  try { return $(name).first().json || {}; }
  catch (_) { return { error: 'node_not_available' }; }
};
const unpack = (r) => {
  if (r && r.body !== undefined) return r.body;
  if (r && r.data !== undefined) return r.data;
  return r;
};
const asJson = (v) => {
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return null; } }
  return v && typeof v === 'object' ? v : null;
};
const sources = [];
const findings = [];
function src(system, r, dataValid, detail = '') {
  const status = typeof r.statusCode === 'number' ? r.statusCode : null;
  const state = status === 200 && dataValid ? 'ok' : 'unavailable';
  sources.push({system, state, http_status:status, checked_at:generatedAt, detail: safe(detail, 130)});
  return state === 'ok';
}
function add(system, severity, title, ref, action) {
  if (findings.length >= 50) return;
  findings.push({source:system, severity, title:safe(title,160), reference:safe(ref,220), next_step:safe(action,200)});
}
// GitHub PRs: first page only. 100 items are an indication of possible truncation.
const prResponse = read('GitHub PRs');
const prRaw = asJson(unpack(prResponse));
const prsOk = src('github_prs', prResponse, Array.isArray(prRaw), 'per_page=100; nur erste Seite');
if(!prsOk)add('github','high','GitHub PR-Liste nicht verfügbar',`${ROOT}/pulls`,'Credentials, Pull requests:read, Netzwerk und API-Limit prüfen');
const prs = prsOk ? prRaw.slice(0,100).map(p => ({
  number:Number(p.number), title:safe(p.title), sha:safe(p.head?.sha,40),
  draft:!!p.draft, updated_at:safe(p.updated_at,40),
  url:`${ROOT}/pull/${Number(p.number)}`
})).filter(p=>Number.isInteger(p.number) && p.number > 0) : [];
if (prsOk && prs.length === 100) add('github','warn','PR-Liste kann paginiert sein (100 Einträge)', `${ROOT}/pulls`, 'GitHub-Pagination ergänzen');
// Read-only check-runs for max 5 PR heads.
const checkResults = read('Collect PR Checks');
const checks = Array.isArray(checkResults.checks) ? checkResults.checks.slice(0, 5).map(c => {
  const n = Number(c.pr_number);
  const number = Number.isInteger(n) && n > 0 ? n : null;
  const fallback = number ? `${ROOT}/pull/${number}/checks` : `${ROOT}/actions`;
  return {
    pr_number: number, head_sha: /^[0-9a-f]{40}$/i.test(String(c.head_sha||'')) ? String(c.head_sha) : null,
    main_fallback: c.main_fallback === true, available: c.available === true,
    http_status: Number.isInteger(c.http_status) ? c.http_status : null,
    total_count: Number.isInteger(c.total_count) && c.total_count >= 0 ? c.total_count : null,
    check_runs: Array.isArray(c.check_runs) ? c.check_runs.slice(0,100).map(k => ({
      name: safe(k.name,100), status: safe(k.status,30), conclusion: safe(k.conclusion,30),
      url: cleanGitHubRef(k.url, fallback)
    })) : []
  };
}) : [];
const checksValid = Array.isArray(checkResults.checks);
const checksAvailable = checks.some(c=>c.available);
sources.push({system:'github_checks',state:checksValid && checksAvailable ? 'partial' : 'unavailable',http_status:null,checked_at:generatedAt,detail:'maximal fünf PR-HEADs; keine vollständige CI-Freigabe'});
const checksByPr = new Map(checks.filter(c=>c.pr_number).map(c=>[Number(c.pr_number),c]));
for(const c of checks) {
  if(!c.pr_number) continue;
  if(!c.available) {
    add('github','warn',`PR #${c.pr_number}: Check-Runs nicht abrufbar`,`${ROOT}/pull/${c.pr_number}`,'Checks:read / Auth und API-Antwort prüfen');
    continue;
  }
  for(const k of (c.check_runs || []).slice(0,100)) {
    if(k.status === 'completed' && ['failure','timed_out','action_required','cancelled'].includes(k.conclusion))
      add('github','high',`PR #${c.pr_number}: Check ${safe(k.name,80)} = ${safe(k.conclusion,30)}`, k.url || `${ROOT}/pull/${c.pr_number}/checks`, 'CI-Log prüfen, kein Merge');
    else if(k.status !== 'completed')
      add('github','observe',`PR #${c.pr_number}: Check ${safe(k.name,80)} läuft/steht aus`,k.url || `${ROOT}/pull/${c.pr_number}/checks`,'CI-Ergebnis abwarten');
  }
}
// GitHub Actions workflow-runs feed: not a substitute for complete PR checks.
const runsResponse = read('GitHub Workflow Runs');
const runsBody = asJson(unpack(runsResponse));
const runsOk = src('github_actions',runsResponse,Array.isArray(runsBody?.workflow_runs),'per_page=100; nur erste Seite');
if(!runsOk)add('github','high','GitHub Actions-Runs nicht verfügbar',`${ROOT}/actions`,'Actions:read, Credential, Rate-Limit und GitHub-API prüfen');
const runs = runsOk ? runsBody.workflow_runs.slice(0,100).map(r=>({
  id:Number(r.id), name:safe(r.name,100), head_sha:safe(r.head_sha,40),
  status:safe(r.status,30), conclusion:safe(r.conclusion,30),
  created_at:safe(r.created_at,40), url:`${ROOT}/actions/runs/${Number(r.id)}`
})).filter(r=>Number.isInteger(r.id)&&r.id>0) : [];
if(runsOk && runs.length===100)add('github','warn','Actions-Feed kann paginiert sein',`${ROOT}/actions`,'GitHub-Pagination ergänzen');
const since=Date.now()-24*60*60*1000;
for(const r of runs.filter(r=>Date.parse(r.created_at)>=since)){
  if(['failure','timed_out','action_required'].includes(r.conclusion))add('github','high',`Workflow ${r.name} fehlgeschlagen (${r.conclusion})`,r.url,'Workflow-Jobs und Logs prüfen');
  else if(r.status !== 'completed' && r.status) add('github','observe',`Workflow ${r.name} ${r.status}`,r.url,'Status erneut prüfen');
}
// GitHub issues (PRs are also returned by the issues REST endpoint; remove them).
const issuesResponse=read('GitHub Issues');
const issuesBody=asJson(unpack(issuesResponse));
const issuesOk=src('github_issues',issuesResponse,Array.isArray(issuesBody),'per_page=100; nur erste Seite');
if(!issuesOk)add('github','warn','GitHub Issues nicht verfügbar',`${ROOT}/issues`,'Issues:read, Credential und API prüfen');
const issues=issuesOk ? issuesBody.filter(x=>!x.pull_request).slice(0,100).map(x=>({
  number:Number(x.number),title:safe(x.title),url:`${ROOT}/issues/${Number(x.number)}`
})).filter(x=>Number.isInteger(x.number)&&x.number>0) : [];
if(issuesOk&&issuesBody.length===100)add('github','warn','Issues-Liste kann paginiert sein',`${ROOT}/issues`,'GitHub-Pagination ergänzen');
// Health response: 503 with body.status=down is a valid outage finding.
const healthResponse=read('RealSync Health');
const healthBody=asJson(unpack(healthResponse));
const healthHttp=healthResponse.statusCode;
const healthValid=(healthHttp===200||healthHttp===503)&&['ok','degraded','down'].includes(healthBody?.status);
sources.push({system:'realsync_health',state:healthValid?healthBody.status:'unavailable',http_status:typeof healthHttp==='number'?healthHttp:null,checked_at:generatedAt,detail:healthValid?'GET /functions/v1/health':'keine gültige Antwort'});
if(!healthValid) add('health','high','RealSync Health nicht verifizierbar','GET /functions/v1/health','HTTP-Endpunkt, Netzwerk und Antwortformat prüfen');
else {
  if(healthBody.status!=='ok')add('health',healthBody.status==='down'?'critical':'high',`Health-Gesamtstatus: ${healthBody.status}`,'GET /functions/v1/health','Einzelchecks prüfen');
  for(const [name,val] of Object.entries(healthBody.checks||{})) {
    if(['unknown','down','degraded'].includes(val?.status)) add('health',val.status==='down'?'high':'observe',`Health ${safe(name,50)}: ${val.status}`,'GET /functions/v1/health','Messlücke oder Fehlerursache prüfen');
  }
}
// Prometheus text parser; only public status/latency/certificate metric families, no URL labels retained.
function unescapeLabel(s) { return s.replace(/\\([\\"n])/g,(_,ch)=>ch==='n'?'\n':ch); }
function labelsOf(s) {
  const out={};
  const re=/(?:^|,)\s*([A-Za-z_][A-Za-z_0-9]*)="((?:\\.|[^"\\])*)"/g;
  for(const m of s.matchAll(re))out[m[1]]=unescapeLabel(m[2]);
  return out;
}
function parsePrometheus(text) {
  if(typeof text !== 'string'||text.length>1_000_000)throw Error('invalid_or_oversized_metrics');
  const m=new Map(); let samples=0;
  for(const line of text.split(/\r?\n/).slice(0,12000)) {
    if(!line||line[0]==='#')continue;
    const match=/^(monitor_status|monitor_response_time|monitor_cert_days_remaining|monitor_cert_is_valid)\{([^}]*)\}\s+([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)(?:\s+\S+)?$/.exec(line.trim());
    if(!match)continue;
    const value=Number(match[3]);if(!Number.isFinite(value))continue;
    const labels=labelsOf(match[2]);
    const name=safe(labels.monitor_name,100);
    const id=safe(labels.monitor_id||'',30);
    if(!name&&!id)continue;
    const key=id||name+'|'+safe(labels.monitor_type,30);
    if(!m.has(key)){if(m.size>=500)continue;m.set(key,{id:id||null,name:name||`Monitor ${id}`,type:safe(labels.monitor_type,30)||null,status:null,latency_ms:null,cert_days_remaining:null,cert_is_valid:null,uptime_7d:null,uptime_30d:null});}
    const row=m.get(key);samples++;
    if(match[1]==='monitor_status')row.status=value;
    if(match[1]==='monitor_response_time')row.latency_ms=value;
    if(match[1]==='monitor_cert_days_remaining')row.cert_days_remaining=value;
    if(match[1]==='monitor_cert_is_valid')row.cert_is_valid=value;
  }
  return {monitors:[...m.values()],samples};
}
// The IF guard bypasses HTTP entirely when UPTIME_KUMA_BASE_URL is absent or invalid.
// On that branch, the synthetic node delivers a clear unavailable reason.
const metricsNode = read('Uptime Kuma Metrics');
const metricsResponse = metricsNode.error === 'node_not_available'
  ? read('Uptime Kuma Not Configured') : metricsNode;
const metricsHttp=metricsResponse.statusCode;
let metricText=unpack(metricsResponse);
if(metricText&&typeof metricText==='object'&&typeof metricText.data==='string')metricText=metricText.data;
let parsed={monitors:[],samples:0};let metricsError=null;
if(metricsHttp===200){try {parsed=parsePrometheus(metricText);}catch(e){metricsError=String(e.message||e);} }
const metricsOK=metricsHttp===200&&parsed.monitors.some(m=>m.status!==null);
sources.push({system:'uptime_kuma',state:metricsOK?'ok':'unavailable',http_status:typeof metricsHttp==='number'?metricsHttp:null,checked_at:generatedAt,detail:metricsOK?'/metrics; status/latency/cert; 7d/30d nicht verfügbar':
  (metricsResponse.error === 'UPTIME_KUMA_BASE_URL_MISSING_OR_INVALID' ? 'UPTIME_KUMA_BASE_URL fehlt oder ist ungültig; HTTP-Abruf bewusst übersprungen' : safe(metricsError||'no monitor_status / credentials / endpoint'))});
if(!metricsOK)add('uptime_kuma','high','Uptime-Kuma-Metriken nicht verifizierbar','/metrics','Version, Netz, API-Key, Credential und Statusmetriken prüfen');
const THRESHOLDS_MS={
  'RealSync Production Frontend':2000,
  'RealSync API':2500,
  'Supabase':3000,
  'n8n':3000
};
const DEFAULT_THRESHOLD_MS=2500; // initial static policy, not a measured 7d baseline
for(const m of parsed.monitors) {
  const ref=`Uptime Kuma monitor_id=${m.id||'(kein ID-Label)'}`;
  if(m.status===0)add('uptime_kuma','critical',`${m.name}: DOWN`,ref,'Dienst und direkte Probe prüfen');
  else if(m.status===2)add('uptime_kuma','observe',`${m.name}: PENDING`,ref,'Erst nach bestätigten Probes bewerten');
  else if(m.status===3)add('uptime_kuma','observe',`${m.name}: MAINTENANCE`,ref,'Wartungsfenster prüfen');
  else if(m.status!==1)add('uptime_kuma','warn',`${m.name}: unbekannter Status`,ref,'Metrikformat und Version prüfen');
  if(m.status===1&&Number.isFinite(m.latency_ms)&&m.latency_ms>(THRESHOLDS_MS[m.name]||DEFAULT_THRESHOLD_MS))
    add('uptime_kuma','warn',`${m.name}: ${m.latency_ms}ms > konfigurierter Grenzwert`,ref,'Latenztrend und Grenzwert prüfen');
  if(m.cert_is_valid===0)add('uptime_kuma','high',`${m.name}: TLS-Zertifikat ungültig`,ref,'TLS-Kette und Zertifikatsdaten prüfen');
  if(Number.isFinite(m.cert_days_remaining)&&m.cert_days_remaining<14)
    add('uptime_kuma',m.cert_days_remaining<7?'high':'warn',`${m.name}: Zertifikat ${m.cert_days_remaining} Tage Restlaufzeit`,ref,'Erneuerung kontrollieren');
}
const RANK={critical:0,high:1,warn:2,observe:3};
findings.sort((a,b)=>(RANK[a.severity]??9)-(RANK[b.severity]??9));
const allAvailable=['github_prs','github_actions','github_issues','realsync_health','uptime_kuma'].every(n=>sources.some(s=>s.system===n&&s.state!=='unavailable'));
const lines=[
  '# RealSync Operations Report (Entwurf, read-only)',
  `Erstellt: ${generatedAt} UTC | Zeitzone: Europe/Berlin`,
  `Datenabdeckung: ${allAvailable?'teilweise/erste Seiten, prüfbar':'unvollständig — mindestens eine Quelle nicht verifiziert'}`,
  '', '## Quellenstatus',
  ...sources.map(s=>`- ${s.system}: ${s.state} (HTTP ${s.http_status??'n/v'}) — ${s.detail}`),
  '', '## Kritische Befunde'
];
if(!findings.length)lines.push('Keine Befunde aus den verfügbaren Ausschnitten; **kein Nachweis eines vollständig fehlerfreien Betriebs**.');
else for(const f of findings.slice(0,20))lines.push(`- [${f.severity}] ${f.title} | Quelle: ${f.reference} | Nächster Schritt: ${f.next_step}`);
lines.push('', '## GitHub Überblick',`- Offene PRs (erste Seite): ${prsOk?prs.length:'nicht verfügbar'}`,
  `- Offene Issues (erste Seite): ${issuesOk?issues.length:'nicht verfügbar'}`,
  `- Workflow-Runs (erste Seite): ${runsOk?runs.length:'nicht verfügbar'}`,
  `- Check-Runs: nur bis zu 5 PR-HEADs; keine vollständige Merge-Freigabe`,
  '', '## Uptime Kuma', `- Gelesene Monitorstatus: ${metricsOK?parsed.monitors.filter(m=>m.status!==null).length:'nicht verfügbar'}`,
  '- Uptime 7 Tage: Nicht verfügbar über /metrics', '- Uptime 30 Tage: Nicht verfügbar über /metrics',
  '- Latenzgrenze: 2500ms Standard oder expliziter Servicewert (keine 7d-Medianmessung)',
  '', '## Freigaben',
  '- Keine Aktionen ausgeführt. Ein allgemeines "Go" ist **keine** Merge-/Deploy-/Secrets-/Infrastruktur-Freigabe.',
  '- Konkrete Merge-Freigabe und ggf. separate Deploy-Freigabe unter AGENTS.md / PR_TRIAGE_POLICY.md erforderlich.',
  '', '## Evidence-Hinweis',
  '- Dieser Workflow schreibt nicht in Supabase oder das Evidence Vault. Nur n8n-Ausführungsdaten können gemäß Instanzkonfiguration gespeichert werden.'
);
return [{json:{schema:'operations_snapshot_v1',generated_at:generatedAt,timezone:'Europe/Berlin',sources,findings:findings.slice(0,50),github:{prs:prs.slice(0,20),issues:issues.slice(0,20),recent_runs:runs.slice(0,20),checks},uptime_kuma:{monitors:parsed.monitors,uptime_7d:'not_available',uptime_30d:'not_available'},report_markdown:lines.join('\n'),approval_required:false,side_effects:[]}}];