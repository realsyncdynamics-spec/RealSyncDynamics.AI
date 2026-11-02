// Each fetched response is paired by input index with the selected PR head.
// Missing or malformed results are unavailable, never "successful".
const targets = $('Select PR Check Targets').all().map(x=>x.json);
const results = $input.all().map(x=>x.json);
const checks=targets.map((t,i)=>{
  const r=results[i]||{};
  let data=r.body??r;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch{data=null;}}
  const available=r.statusCode===200&&Array.isArray(data?.check_runs);
  return {pr_number:t.pr_number,head_sha:t.sha,main_fallback:t.main_fallback,available,
    http_status:typeof r.statusCode==='number'?r.statusCode:null,
    total_count:available?Number(data.total_count)||data.check_runs.length:null,
    check_runs:available?data.check_runs.slice(0,100).map(c=>({
      name:String(c.name||'').slice(0,100), status:String(c.status||'').slice(0,30),
      conclusion:String(c.conclusion||'').slice(0,30),
      url:typeof c.html_url==='string' && c.html_url.startsWith('https://github.com/')?c.html_url:null
    })):[]};
});
return [{json:{checks,scope:'at most 5 PRs; first page of check-runs each'}}];
