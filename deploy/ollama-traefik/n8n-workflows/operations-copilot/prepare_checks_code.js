// Bounded read-only check target selection. Zero PRs => main as fallback,
// explicitly flagged so the report does not treat it as a PR check.
const response = $input.first().json;
let body = response.body ?? response;
if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
const prs = response.statusCode === 200 && Array.isArray(body) ? body : [];
const targets = prs.filter(x=>typeof x.head?.sha === 'string' && /^[0-9a-f]{40}$/i.test(x.head.sha)).slice(0,5)
  .map(x=>({pr_number:Number(x.number),sha:x.head.sha,main_fallback:false}));
if (!targets.length)targets.push({pr_number:null,sha:'main',main_fallback:true});
return targets.map(x=>({json:x}));
