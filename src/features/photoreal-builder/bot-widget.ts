import type { BotFacts } from './bot-engine';

function esc(s: string) {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

/** Inline widget. Knowledge stays in the page. No third-country model call. */
export function renderBotWidget(facts: BotFacts): string {
  const payload = JSON.stringify(facts).replace(/</g, "\\u003c");
  return `
<div id="rs-bot" class="rs-bot">
  <button type="button" class="rs-bot-fab" id="rs-open" aria-expanded="false" aria-controls="rs-panel">Assistent</button>
  <section id="rs-panel" class="rs-panel" hidden>
    <header>
      <strong>KI-Assistent</strong>
      <span>EU AI Act Art. 50 · begrenzt · EU-hosted</span>
    </header>
    <p class="rs-notice">Kein Mensch. Keine Trainingsnutzung. Antworten nur aus den übernommenen Fakten von ${esc(facts.company)}.</p>
    <div id="rs-consent" class="rs-consent">
      <label><input type="checkbox" id="rs-ok"/> Ich willige ein, dass diese Unterhaltung zum Zweck der Anfrage/Terminverwaltung verarbeitet wird (Art. 6 Abs. 1 lit. a DSGVO). Widerruf: Fenster schließen.</label>
      <button type="button" id="rs-go" class="cta" disabled>Chat starten</button>
    </div>
    <div id="rs-chat" hidden>
      <ol id="rs-log"></ol>
      <form id="rs-form">
        <input id="rs-in" maxlength="400" placeholder="Frage oder Termin…" autocomplete="off"/>
        <button class="cta" type="submit">Senden</button>
      </form>
    </div>
    <p class="rs-ev" id="rs-ev">Evidence bereit</p>
  </section>
</div>
<style>
.rs-bot{position:fixed;right:18px;bottom:18px;z-index:30;font-family:Outfit,system-ui,sans-serif}
.rs-bot-fab{min-height:48px;padding:0 16px;border:0;border-radius:999px;background:var(--accent);color:var(--btn);font-weight:600;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.rs-panel{position:absolute;right:0;bottom:58px;width:min(380px,calc(100vw - 28px));max-height:min(70vh,560px);overflow:auto;background:var(--bg);color:var(--fg);border:1px solid var(--line);padding:14px}
.rs-panel header{display:flex;flex-direction:column;gap:2px;margin-bottom:8px}
.rs-panel header span,.rs-notice,.rs-ev,.rs-consent{font-size:11px;color:var(--muted);line-height:1.45}
.rs-consent label{display:flex;gap:8px;align-items:flex-start;margin:10px 0}
.rs-consent input{width:auto;margin-top:3px}
#rs-log{list-style:none;padding:0;margin:0 0 10px;display:flex;flex-direction:column;gap:8px;max-height:280px;overflow:auto}
#rs-log li{padding:8px 10px;border:1px solid var(--line);font-size:13px;line-height:1.4}
#rs-log li.me{align-self:flex-end;background:var(--card)}
#rs-form{display:flex;gap:6px}
#rs-in{flex:1;min-height:44px;border:1px solid var(--line);background:transparent;padding:0 10px;color:var(--fg)}
.rs-slots{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.rs-slots button{border:1px solid var(--line);background:transparent;color:var(--fg);padding:6px 8px;font-size:11px;cursor:pointer}
</style>
<script>
(function(){
  const facts = ${payload};
  const openBtn = document.getElementById('rs-open');
  const panel = document.getElementById('rs-panel');
  const ok = document.getElementById('rs-ok');
  const go = document.getElementById('rs-go');
  const chat = document.getElementById('rs-chat');
  const consent = document.getElementById('rs-consent');
  const log = document.getElementById('rs-log');
  const form = document.getElementById('rs-form');
  const input = document.getElementById('rs-in');
  const ev = document.getElementById('rs-ev');
  let consented = false;
  function evidence(t){ ev.textContent = 'Evidence · ' + t + ' · ' + new Date().toISOString().slice(11,19); }
  function add(text, me){
    const li = document.createElement('li');
    if (me) li.className = 'me';
    li.textContent = text;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    return li;
  }
  function slots(){
    const out=[]; const times=['10:00','14:30'];
    for(let d=1;d<=4;d++){ const dt=new Date(); dt.setDate(dt.getDate()+d); if(dt.getDay()===0) dt.setDate(dt.getDate()+1);
      const day=dt.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
      times.forEach(t=>out.push(day+' '+t)); }
    return out.slice(0,6);
  }
  function reply(raw){
    const q = (raw||'').trim().toLowerCase();
    if(!q) return {text:'Ich bin der Assistent von '+facts.company+'. KI, begrenztes Risiko, Art. 50 EU AI Act. EU-gehostet, keine Trainingsnutzung.', kind:'system', evidence:'bot.session.opened'};
    if(/mensch|person|mitarbeiter|hotline|anrufen/.test(q)) return {text:'Handoff: '+ (facts.phones[0] ? 'Telefon '+facts.phones[0] : 'Telefon nicht in der Quelle') +'.', kind:'handoff', evidence:'bot.handoff.requested'};
    if(/lösch|loesch|vergiss|daten raus|auskunft/.test(q)) return {text:'Chat nur im Browser. Fenster schließen löscht ihn. Keine Serverkopie.', kind:'legal', evidence:'bot.dsr.explained'};
    if(/impressum|datenschutz|dsgvo|ai act/.test(q)) return {text:(facts.hasImpressum?'Impressum vorhanden. ':'Impressum: NEEDS CUSTOMER INPUT. ')+(facts.hasDatenschutz?'Datenschutz erkannt.':'Datenschutz: NEEDS CUSTOMER INPUT.')+' Zweck: Anfrage/Termin. Art. 6 Abs. 1 lit. a DSGVO.', kind:'legal', evidence:'bot.legal.answered'};
    if(/termin|buch|slot|uhrzeit|wann kann/.test(q)) return {text:'Zweckbindung Terminverwaltung. Wählen Sie einen Slot.', kind:'booking', evidence:'bot.booking.offered', slots: slots()};
    if(/mail|e-mail|email|telefon|phone|adresse|anschrift|standort/.test(q)){
      const bits=[facts.emails[0]&&('E-Mail '+facts.emails[0]), facts.phones[0]&&('Telefon '+facts.phones[0]), facts.address&&('Ort '+facts.address), facts.hours&&('Zeiten '+facts.hours)].filter(Boolean);
      return {text: bits.length? bits.join(' · ') : 'Kontakt: NEEDS CUSTOMER INPUT.', kind: bits.length?'answer':'refuse', evidence:'bot.contact.answered'};
    }
    if(/preis|kosten|gebühr|euro/.test(q)) return {text:'Preise erfinde ich nicht.', kind:'refuse', evidence:'bot.price.refused'};
    if(/leistung|service|angebot|was macht|was bietet/.test(q)){
      if(!facts.services.length) return {text:'Leistungen: NEEDS CUSTOMER INPUT.', kind:'refuse', evidence:'bot.services.missing'};
      return {text: facts.services.map(s=>s.title+': '+s.description).join('\\n'), kind:'answer', evidence:'bot.services.answered'};
    }
    if(/öffnungs|offen|zeiten/.test(q)) return {text: facts.hours || 'Öffnungszeiten: NEEDS CUSTOMER INPUT.', kind: facts.hours?'answer':'refuse', evidence:'bot.hours.answered'};
    if(/wer seid|über euch|firma|unternehmen/.test(q)) return {text: facts.description || facts.company, kind:'answer', evidence:'bot.about.answered'};
    return {text:'Steht nicht in der Quelle. Ich erfinde nichts. Fragen Sie Leistungen, Kontakt, Termin — oder einen Menschen.', kind:'refuse', evidence:'bot.unknown.refused'};
  }
  openBtn.addEventListener('click', ()=>{
    const hide = !panel.hidden;
    panel.hidden = hide;
    openBtn.setAttribute('aria-expanded', String(!hide));
  });
  ok.addEventListener('change', ()=>{ go.disabled = !ok.checked; });
  go.addEventListener('click', ()=>{
    if(!ok.checked) return;
    consented = true;
    consent.hidden = true;
    chat.hidden = false;
    const r = reply('');
    add(r.text, false);
    evidence(r.evidence);
  });
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!consented) return;
    const v = input.value.trim();
    if(!v) return;
    add(v, true);
    input.value = '';
    const r = reply(v);
    const li = add(r.text, false);
    evidence(r.evidence);
    if(r.slots){
      const wrap = document.createElement('div');
      wrap.className = 'rs-slots';
      r.slots.forEach(s=>{
        const b = document.createElement('button');
        b.type='button'; b.textContent=s;
        b.onclick=()=>{
          add('Slot '+s, true);
          add('Vorgemerkt: '+s+'. Name und E-Mail bitte über Kontakt senden. Evidence: booking.created (lokal, EU).', false);
          evidence('bot.booking.created');
        };
        wrap.appendChild(b);
      });
      li.appendChild(wrap);
    }
  });
})();
</script>`;
}
