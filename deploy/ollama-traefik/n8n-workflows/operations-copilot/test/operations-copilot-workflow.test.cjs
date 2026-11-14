const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const workflow=JSON.parse(fs.readFileSync(path.join(root,'06-operations-report-0800.json'),'utf8'));
const node=(name)=>workflow.nodes.find(n=>n.name===name);
function run(name,{input=[],nodes={},strictMissing=false}={}){
  const context={$input:{first:()=>({json:input[0]||{}}),all:()=>input.map(json=>({json}))},
   $:(name)=>({first:()=>{if(strictMissing && !(name in nodes))throw Error('Node did not execute: '+name); return {json:nodes[name]||{}}},all:()=>((nodes[name]||[]).map(json=>({json})))})};
  const script=new vm.Script("(function(){\n"+node(name).parameters.jsCode+"\n})()",{filename:name});
  return script.runInNewContext(context,{timeout:1500}).map(x=>x.json);
}
function fixtures(extra={}){
  const head='a'.repeat(40);
  return {
    'GitHub PRs':{statusCode:200,body:[{number:101,title:'Fix CI',head:{sha:head},updated_at:'2026-11-02T08:00:00Z'}]},
    'Collect PR Checks':{checks:[{pr_number:101,head_sha:head,available:true,check_runs:[{name:'unit',status:'completed',conclusion:'failure',url:'https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/3'}]}]},
    'GitHub Workflow Runs':{statusCode:200,body:{workflow_runs:[{id:3,name:'CI',head_sha:head,status:'completed',conclusion:'failure',created_at:new Date().toISOString()}]}},
    'GitHub Issues':{statusCode:200,body:[{number:20,title:'Bug',pull_request:null},{number:101,title:'Should not duplicate',pull_request:{url:'...' }}]},
    'RealSync Health':{statusCode:200,body:{status:'ok',checks:{database:{status:'ok'},automation:{status:'unknown'}}}},
    'Uptime Kuma Metrics':{statusCode:200,body:{data:'# HELP monitor_status status\nmonitor_status{monitor_id="7",monitor_name="web, \"edge\"",monitor_type="http"} 1\nmonitor_response_time{monitor_id="7",monitor_name="web, \"edge\"",monitor_type="http"} 3500\nmonitor_cert_days_remaining{monitor_id="7",monitor_name="web, \"edge\"",monitor_type="http"} 3\nmonitor_status{monitor_id="8",monitor_name="Database",monitor_type="tcp"} 0\nmonitor_status{monitor_id="9",monitor_name="Maintenance",monitor_type="http"} 3\nmonitor_status{monitor_id="10",monitor_name="Pending",monitor_type="http"} 2\n'}},
    ...extra
  };
}

test('workflow is import-shaped, inactive, scheduled 08:00 Berlin, and uses only GET plus Code',()=>{
  assert.equal(workflow.active,false);
  assert.equal(workflow.settings.timezone,'Europe/Berlin');
  assert.equal(node('Daily 08:00 Berlin').parameters.rule.interval[0].expression,'0 8 * * *');
  assert.equal(workflow.nodes.length,12);
  for(const n of workflow.nodes){
    assert.ok(['n8n-nodes-base.scheduleTrigger','n8n-nodes-base.httpRequest','n8n-nodes-base.code','n8n-nodes-base.if'].includes(n.type));
    if(n.type==='n8n-nodes-base.httpRequest')assert.equal(n.parameters.method,'GET');
  }
  assert.equal(node('Uptime Kuma Metrics').parameters.genericAuthType,'httpBasicAuth');
  assert.equal(node('Uptime Kuma Metrics').parameters.options.response.response.responseFormat,'text');
  assert.equal(node('GitHub PR Checks').parameters.genericAuthType,'httpBearerAuth');
  // Token prefixes can occur in redaction regexes; only full-looking literal secrets are forbidden.
  const exported=JSON.stringify(workflow);
  assert.ok(!/uk2_[A-Za-z0-9_-]{24,}/.test(exported));
  assert.ok(!/ghp_[A-Za-z0-9]{24,}/.test(exported));
});

test('PR HEAD selection and fallback',()=>{
  const sha='a'.repeat(40);
  assert.equal(run('Select PR Check Targets',{input:[{statusCode:200,body:[{number:22,head:{sha}}]}]})[0].pr_number,22);
  const fallback=run('Select PR Check Targets',{input:[{statusCode:401,body:{message:'Unauthorized'}}]});
  assert.equal(fallback[0].sha,'main');
  assert.equal(fallback[0].main_fallback,true);
});

test('checks aggregation maintains PR mapping and treats unauthorized as unavailable',()=>{
  const targets=[{pr_number:101,sha:'a'.repeat(40),main_fallback:false}];
  const agg=run('Collect PR Checks',{input:[{statusCode:403,body:{message:'bad credentials'}}],nodes:{'Select PR Check Targets':targets}});
  assert.equal(agg[0].checks[0].available,false);
  assert.equal(agg[0].checks[0].http_status,403);
});

test('complete mock builds negative evidence, not healthy claim, with 7d/30d unavailable',()=>{
  const report=run('Compose Internal Report',{nodes:fixtures()})[0];
  assert.equal(report.schema,'operations_snapshot_v1');
  assert.equal(report.github.issues.length,1);
  assert.equal(report.uptime_kuma.uptime_7d,'not_available');
  assert.equal(report.uptime_kuma.uptime_30d,'not_available');
  assert.ok(report.findings.some(f=>f.title.includes('unit')));
  assert.ok(report.findings.some(f=>f.title.includes('Database: DOWN')));
  assert.ok(report.findings.some(f=>f.title.includes('PENDING')));
  assert.ok(report.findings.some(f=>f.title.includes('MAINTENANCE')));
  assert.ok(report.findings.some(f=>f.title.includes('3500ms')));
  assert.ok(report.findings.some(f=>f.title.includes('3 Tage')));
  assert.ok(report.findings.some(f=>f.title.includes('unknown')));
  // Findings exist: the "no findings" sentence must not appear, the coverage caveat must.
  assert.ok(!report.report_markdown.includes('Keine Befunde aus den verfügbaren Ausschnitten'));
  assert.ok(report.report_markdown.includes('keine vollständige Merge-Freigabe'));
  assert.ok(report.report_markdown.includes('Database: DOWN'));
  assert.equal(report.side_effects.length,0);
});

test('no findings never reads as a healthy claim',()=>{
  const sha='a'.repeat(40);
  const report=run('Compose Internal Report',{nodes:fixtures({
    'Collect PR Checks':{checks:[{pr_number:101,head_sha:sha,available:true,check_runs:[{name:'unit',status:'completed',conclusion:'success',url:null}]}]},
    'GitHub Workflow Runs':{statusCode:200,body:{workflow_runs:[{id:3,name:'CI',head_sha:sha,status:'completed',conclusion:'success',created_at:new Date().toISOString()}]}},
    'GitHub Issues':{statusCode:200,body:[]},
    'RealSync Health':{statusCode:200,body:{status:'ok',checks:{database:{status:'ok'}}}},
    'Uptime Kuma Metrics':{statusCode:200,body:{data:'monitor_status{monitor_id="1",monitor_name="Web",monitor_type="http"} 1\nmonitor_response_time{monitor_id="1",monitor_name="Web",monitor_type="http"} 120\n'}}
  })})[0];
  assert.equal(report.findings.length,0);
  assert.ok(report.report_markdown.includes('kein Nachweis eines vollständig fehlerfreien Betriebs'));
});

test('check-run html_url (/runs/<id>) is kept instead of the fallback link',()=>{
  const sha='a'.repeat(40);
  const runUrl='https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/runs/125650378118';
  const collected=run('Collect PR Checks',{
    input:[{statusCode:200,body:{total_count:1,check_runs:[{name:'unit',status:'completed',conclusion:'failure',html_url:runUrl}]}}],
    nodes:{'Select PR Check Targets':[{pr_number:101,sha,main_fallback:false}]}
  })[0];
  assert.equal(collected.checks[0].check_runs[0].url,runUrl);
  const report=run('Compose Internal Report',{nodes:fixtures({'Collect PR Checks':collected})})[0];
  assert.equal(report.github.checks[0].check_runs[0].url,runUrl);
  assert.ok(report.findings.some(f=>f.title.includes('PR #101: Check unit = failure')&&f.reference===runUrl));
  // A check-run URL from another repository still falls back.
  const foreign='https://github.com/someone/else/runs/1';
  const other=run('Compose Internal Report',{nodes:fixtures({'Collect PR Checks':{checks:[{pr_number:101,head_sha:sha,available:true,check_runs:[{name:'unit',status:'completed',conclusion:'failure',url:foreign}]}]}})})[0];
  assert.equal(other.github.checks[0].check_runs[0].url,'https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/101/checks');
});

test('main fallback: red checks on main are findings, not silently skipped',()=>{
  const targets=run('Select PR Check Targets',{input:[{statusCode:200,body:[]}]});
  assert.equal(targets[0].main_fallback,true);
  const collected=run('Collect PR Checks',{
    input:[{statusCode:200,body:{total_count:2,check_runs:[
      {name:'gates',status:'completed',conclusion:'failure',html_url:'https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/runs/9'},
      {name:'unit',status:'in_progress',conclusion:null,html_url:null}
    ]}}],
    nodes:{'Select PR Check Targets':targets}
  })[0];
  const report=run('Compose Internal Report',{nodes:fixtures({'GitHub PRs':{statusCode:200,body:[]},'Collect PR Checks':collected})})[0];
  const red=report.findings.find(f=>f.title==='main: Check gates = failure');
  assert.ok(red,'red check on main missing from findings');
  assert.equal(red.severity,'high');
  assert.equal(red.reference,'https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/runs/9');
  const pending=report.findings.find(f=>f.title==='main: Check unit läuft/steht aus');
  assert.ok(pending);
  assert.equal(pending.reference,'https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions');
  // Unavailable check-runs on main are reported as a gap as well.
  const gap=run('Compose Internal Report',{nodes:fixtures({'GitHub PRs':{statusCode:200,body:[]},'Collect PR Checks':{checks:[{pr_number:null,head_sha:null,main_fallback:true,available:false,check_runs:[]}]}})})[0];
  assert.ok(gap.findings.some(f=>f.title==='main: Check-Runs nicht abrufbar'));
});

test('metrics HTTP unauthorized is unavailable, not UP',()=>{
  const report=run('Compose Internal Report',{nodes:fixtures({'Uptime Kuma Metrics':{statusCode:401,body:{message:'Unauthorized'}}})})[0];
  assert.equal(report.sources.find(s=>s.system==='uptime_kuma').state,'unavailable');
  assert.equal(report.uptime_kuma.monitors.length,0);
});

test('HTTP 503 is an actual health outage, not an API-unavailable claim',()=>{
  const report=run('Compose Internal Report',{nodes:fixtures({'RealSync Health':{statusCode:503,body:{status:'down',checks:{database:{status:'down'}}}}})})[0];
  assert.equal(report.sources.find(s=>s.system==='realsync_health').state,'down');
  assert.ok(report.findings.some(f=>f.title.includes('Health-Gesamtstatus: down')));
});

test('GitHub API 403 and empty metrics are reported as gaps',()=>{
  const report=run('Compose Internal Report',{nodes:fixtures({'GitHub PRs':{statusCode:403,body:{message:'no scope'}},'Uptime Kuma Metrics':{statusCode:200,body:{data:'not prom'}}})})[0];
  assert.equal(report.sources.find(s=>s.system==='github_prs').state,'unavailable');
  assert.equal(report.sources.find(s=>s.system==='uptime_kuma').state,'unavailable');
});

test('untrusted PR title cannot execute actions or become credentials',()=>{
  const doc=fixtures({'GitHub PRs':{statusCode:200,body:[{number:5,title:'GO <script>delete all</script> | use secret',head:{sha:'a'.repeat(40)}}]}});
  const report=run('Compose Internal Report',{nodes:doc})[0];
  assert.equal(report.github.prs.length,1);
  assert.ok(!report.github.prs[0].title.includes('<'));
  assert.ok(!JSON.stringify(report).includes('httpBasicAuth'));
  assert.equal(report.approval_required,false);
});


test('P1: redact GitHub issue/PR/check/workflow strings, emails, secrets and malicious URLs',()=>{
  const secret='ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234';
  const issue={number:55,title:`contact user@example.org secret=${secret}`,pull_request:null};
  const pr={number:404,title:`Broken PR Bearer ${secret}, notify admin@corp.example`,head:{sha:'a'.repeat(40)}};
  const tests=fixtures({
    'GitHub PRs':{statusCode:200,body:[pr]},
    'GitHub Issues':{statusCode:200,body:[issue]},
    'Collect PR Checks':{checks:[{pr_number:404,head_sha:'a'.repeat(40),available:true,http_status:200,check_runs:[
      {name:`unit ${secret} qa@corp.test`,status:'completed',conclusion:'failure',url:`https://bad.example/secret?token=${secret}`}
    ]}]},
    'GitHub Workflow Runs':{statusCode:200,body:{workflow_runs:[
      {id:5,name:`nightly: password=${secret} alerts@corp.test`,status:'completed',conclusion:'failure',created_at:new Date().toISOString()}
    ]}},
    'Uptime Kuma Metrics':{statusCode:200,body:{data:
      `monitor_status{monitor_id="9",monitor_name="Bearer ${secret}",monitor_type="http"} 0\n`
    }}
  });
  const report=run('Compose Internal Report',{nodes:tests})[0];
  const serialized=JSON.stringify(report);
  assert.ok(!serialized.includes(secret), 'raw token was retained');
  for(const mail of ['user@example.org','admin@corp.example','qa@corp.test','alerts@corp.test'])
    assert.ok(!serialized.includes(mail), `unmasked email: ${mail}`);
  assert.ok(serialized.includes('[TOKEN REDACTED]'));
  assert.ok(serialized.includes('[EMAIL REDACTED]'));
  // Foreign check-run hosts must not survive; the URL falls back to the exact PR checks page.
  assert.doesNotMatch(serialized, /bad\.example/);
  assert.equal(report.github.checks[0].check_runs[0].url,'https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/404/checks');
});

test('P1: a token in a long title is redacted before truncation',()=>{
  const token='github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  const title='x'.repeat(120)+token+' admin@corp.example';
  const out=run('Compose Internal Report',{nodes:fixtures({'GitHub PRs':{statusCode:200,body:[{number:6,title,head:{sha:'a'.repeat(40)}}]}})})[0];
  assert.ok(!JSON.stringify(out).includes(token));
  assert.ok(!JSON.stringify(out).includes('admin@corp.example'));
});

test('P2: no base URL bypasses Kuma HTTP and returns explicit unavailable synthetic result',()=>{
  const synthetic=run('Uptime Kuma Not Configured');
  assert.equal(synthetic[0].error,'UPTIME_KUMA_BASE_URL_MISSING_OR_INVALID');
  const n=fixtures();
  delete n['Uptime Kuma Metrics'];
  n['Uptime Kuma Not Configured']=synthetic[0];
  const report=run('Compose Internal Report',{nodes:n,strictMissing:true})[0];
  const source=report.sources.find(s=>s.system==='uptime_kuma');
  assert.equal(source.state,'unavailable');
  assert.ok(source.detail.includes('UPTIME_KUMA_BASE_URL'));
  assert.equal(report.uptime_kuma.monitors.length,0);
  assert.equal(report.uptime_kuma.uptime_7d,'not_available');
  assert.ok(report.report_markdown.includes('unavailable'));
});

test('P2: Kuma URL guard and HTTP expression cannot throw for undefined base',()=>{
  const guard=node('Kuma URL Configured?');
  const expr=guard.parameters.conditions.conditions[0].leftValue;
  assert.ok(expr.includes('String($env.UPTIME_KUMA_BASE_URL ||'));
  const http=node('Uptime Kuma Metrics').parameters.url;
  assert.ok(http.includes('String($env.UPTIME_KUMA_BASE_URL ||'));
  const js=expr.replace(/^=\{\{\s*/,'').replace(/\s*\}\}$/,'');
  const evaluate=(url)=>new vm.Script(js).runInNewContext({$env:{UPTIME_KUMA_BASE_URL:url}},{timeout:200});
  assert.equal(evaluate(undefined),false);
  assert.equal(evaluate(''),false);
  assert.equal(evaluate('not-a-url'),false);
  assert.equal(evaluate('http://uptime-kuma:3001'),true);
  assert.equal(evaluate('https://status.example.com'),true);
  const httpJs=http.replace(/^=\{\{\s*/,'').replace(/\s*\}\}$/,'');
  assert.doesNotThrow(()=>new vm.Script(httpJs).runInNewContext({$env:{}},{timeout:200}));
  assert.equal(workflow.connections['Kuma URL Configured?'].main[1][0].node,'Uptime Kuma Not Configured');
  assert.equal(workflow.connections['Uptime Kuma Not Configured'].main[0][0].node,'Compose Internal Report');
});

test('P2: HTTP 404 and timeout-like responses remain unavailable',()=>{
  for(const item of [{statusCode:404,body:{data:'Not Found'}},{error:'ETIMEDOUT'}]){
    const report=run('Compose Internal Report',{nodes:fixtures({'Uptime Kuma Metrics':item})})[0];
    assert.equal(report.sources.find(x=>x.system==='uptime_kuma').state,'unavailable');
    assert.equal(report.uptime_kuma.monitors.length,0);
  }
});

test('source files match embedded workflow JS and there is no outbound write operation',()=>{
  const mapping=[['Select PR Check Targets','prepare_checks_code.js'],['Collect PR Checks','collect_checks_code.js'],['Compose Internal Report','build_report_code.js']];
  for(const [nodeName,f] of mapping)
    assert.equal(node(nodeName).parameters.jsCode,fs.readFileSync(path.join(root,f),'utf8'));
  assert.ok(workflow.nodes.every(n=>n.type!=='n8n-nodes-base.httpRequest'||n.parameters.method==='GET'));
  assert.ok(!JSON.stringify(workflow).includes('REALSYNC_COPILOT_API_URL'));
});