// RealSync Dynamics & AI — Unternehmensseite /unternehmen/ (aus Entwurf v5 → v6). Ausgelagert wegen CSP (script-src 'self').
(() => {
  const APP = '';
  const MAP = { 'governance-os': APP + '/', audit: APP + '/audit',  builder: APP + '/frontend-builder', login: APP + '/login', 'r-impressum': APP + '/impressum', datenschutz: APP + '/datenschutz', agb: APP + '/agb', widerruf: APP + '/widerruf', avv: APP + '/legal/avv', subproc: APP + '/legal/sub-processors' };
  document.querySelectorAll('a[href^="#"]').forEach((a) => { const k = a.getAttribute('href').slice(1); if (MAP[k] && MAP[k].startsWith('http')) { a.href = MAP[k]; a.target = '_blank'; a.rel = 'noopener'; } else if (MAP[k]) a.href = MAP[k]; });
  const hd = document.querySelector('header'), bar = document.getElementById('progress'), links = [...document.querySelectorAll('header .navlink')];
  const secs = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  const pb = [...document.querySelectorAll('header .pbtn')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero'), hFx = [...document.querySelectorAll('.hero h1, .hero .lede')];
  const zones = [...links.map((l) => l.getAttribute('href').slice(1)), 'produkte', 'galerie', 'voice', 'unternehmen', 'kontakt'];
  const htg = document.querySelector('.htiles');
  let max = 1, tops = [], tick = false, lastCur = -2, lastStuck = null;
  const measure = () => { max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    tops = links.map((l) => { const s = document.getElementById(l.getAttribute('href').slice(1)); return s ? s.getBoundingClientRect().top + scrollY : Infinity; }); };
  const frame = () => { tick = false; const y = scrollY;
    bar.style.transform = 'scaleX(' + (y / max).toFixed(4) + ')';
    const st = y > 40; if (st !== lastStuck) { hd.classList.toggle('stuck', st); lastStuck = st; }
    let cur = -1; for (let i = 0; i < tops.length; i++) if (tops[i] - innerHeight * .45 <= y) cur = i;
    if (cur !== lastCur) { links.forEach((l, i) => l.classList.toggle('on', i === cur)); lastCur = cur; }
    window.__sy = -Math.min(y, innerHeight) * .32;
    if (!reduce && y < innerHeight * 1.2) { const k = Math.min(1, y / innerHeight); hFx.forEach((el, i) => { el.style.transform = 'translate3d(0,' + (-y * (.06 + i * .03)).toFixed(1) + 'px,0)'; el.style.opacity = (1 - k * .85).toFixed(3); }); } };
  const req = () => { if (!tick) { tick = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', () => { measure(); req(); });
  new ResizeObserver(() => { measure(); req(); }).observe(document.body); addEventListener('load', () => { measure(); req(); }); measure(); frame();
  document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { const t = document.getElementById(a.dataset.go); if (!t) return; e.preventDefault();
    const y = t.getBoundingClientRect().top + scrollY - 110; scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); t.classList.remove('pulse'); setTimeout(() => t.classList.add('pulse'), 450); }));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); e.target.addEventListener('transitionend', () => { e.target.style.willChange = 'auto'; }, { once: true }); io.unobserve(e.target); } }), { threshold: .08, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.rv').forEach((e) => { const sib = [...e.parentElement.children].filter((c) => c.classList.contains('rv')); e.style.transitionDelay = (sib.indexOf(e) * 90) + 'ms'; io.observe(e); });
  // Kontakt → Supabase Edge Function sales-lead (verify_jwt=false, Rate-Limit 5/h)
  const SB_URL = 'https://ebljyceifhnlzhjfyxup.supabase.co', SB_ANON = 'sb_publishable_BqKKWFM8zcb8R5NXifVgjA_pIYunrhB', LEAD_URL = SB_URL + '/functions/v1/sales-lead';
  const cf = document.getElementById('cform'), cnote = document.getElementById('c-note'), csend = document.getElementById('c-send');
  cf.addEventListener('submit', async (e) => { e.preventDefault(); if (document.getElementById('c-hp').value) return;
    const email = document.getElementById('c-mail').value.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { cnote.textContent = 'Bitte eine gültige E-Mail-Adresse angeben.'; return; }
    csend.disabled = true; cnote.textContent = 'Wird gesendet …';
    const body = { name: document.getElementById('c-name').value.trim(), email, company: document.getElementById('c-co').value.trim() || undefined, message: document.getElementById('c-msg').value.trim().slice(0, 4000), source: 'company-landing', use_case: 'kontakt', path: location.pathname };
    try { const r = await fetch(LEAD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { cnote.textContent = 'Danke – Ihre Nachricht ist angekommen. Wir melden uns persönlich.'; cf.reset(); }
      else if (r.status === 429) { cnote.textContent = 'Zu viele Anfragen. Bitte später erneut versuchen.'; csend.disabled = false; }
      else { cnote.textContent = 'Senden fehlgeschlagen. Schreiben Sie uns direkt an info@realsyncdynamicsai.de.'; csend.disabled = false; } }
    catch { cnote.textContent = 'Keine Verbindung. Schreiben Sie uns direkt an info@realsyncdynamicsai.de.'; csend.disabled = false; } });
  // Tafeln: Tiefe aus dem Hintergrund (klein/hinten → groß/vorn), gekoppelt an Erde + Maus
  (() => { const grp = document.querySelector('.htiles'); if (!grp || reduce) return; const T = [...grp.querySelectorAll('.htile')], BY = [5, 0, -5];
    const S = T.map((el, i) => ({ el, d: 0, rx: 0, ry: 0, trx: 0, tr: 0, td: 0, idle: i === 1 ? .82 : .74 }));
    let hv = -1, mx = 0, my = 0, gx = 0, gy = 0, sy = 0, last = performance.now(), fine = matchMedia('(hover: hover)').matches;
    S.forEach((s, i) => setTimeout(() => { s.ready = true; }, 250 + i * 230));
    T.forEach((el, i) => { const on = () => { hv = i; }, off = () => { if (hv === i) { hv = -1; S[i].trx = 0; S[i].tr = 0; } };
      el.addEventListener('pointerenter', on); el.addEventListener('pointerleave', off); el.addEventListener('focus', on); el.addEventListener('blur', off);
      el.addEventListener('pointermove', (e) => { if (!fine) return; const r = el.getBoundingClientRect(); S[i].tr = ((e.clientX - r.left) / r.width - .5) * 14; S[i].trx = -((e.clientY - r.top) / r.height - .5) * 10; el.style.setProperty('--glx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); el.style.setProperty('--gly', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); el.style.setProperty('--gla', 1); });
      el.addEventListener('pointerleave', () => el.style.setProperty('--gla', 0)); });
    if (fine) addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; window.__mx = mx; window.__my = my; }, { passive: true });
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; if (document.hidden || scrollY > innerHeight * 1.4) return;
      const k = 1 - Math.exp(-dt * 6.5), kt = 1 - Math.exp(-dt * 10);
      S.forEach((s, i) => { const tgt = !s.ready ? 0 : hv === i ? 1 : s.idle; s.d += (tgt - s.d) * k; s.rx += (s.trx - s.rx) * kt; s.ry += (s.tr - s.ry) * kt;
        const tt = now / 1000, fl = hv === i ? .25 : 1, fx = Math.sin(tt * .6 + i * 2.1) * 7 * fl, fy = Math.cos(tt * .5 + i * 1.7) * 6 * fl + sy * (.8 + i * .18), fz = Math.sin(tt * .42 + i * 1.3) * 22 * fl, fr = Math.sin(tt * .35 + i * 2.6) * 2.2 * fl;
        const d = s.d, sc = .84 + .26 * d, z = -240 + 380 * d + fz, tx = (1 - i) * (1 - d) * 26 + fx, ty = (1 - d) * 46 + fy, o = Math.max(0, Math.min(1, .15 + d * 1.25)), bl = Math.max(0, .45 - d) * 7;
        s.el.style.setProperty('--t', 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + (s.ry + fr + BY[i] * (1 - d * .6)).toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')');
        s.el.style.setProperty('--o', o.toFixed(3)); s.el.style.setProperty('--f', bl > .15 ? 'blur(' + bl.toFixed(1) + 'px)' : 'none'); s.el.style.zIndex = Math.round(d * 10); });
      gx += (mx - gx) * k * .6; gy += (my - gy) * k * .6; sy += ((window.__sy || 0) - sy) * k;
      };
    requestAnimationFrame(loop); })();
  // Vorlagen wählen
  (() => { const g = document.getElementById('tpls'), note = document.getElementById('tpl-note'), go = document.getElementById('tpl-go'), msg = document.getElementById('c-msg'); if (!g) return;
    g.addEventListener('click', (e) => { const b = e.target.closest('.tpl'); if (!b) return; const on = b.getAttribute('aria-pressed') !== 'true'; g.querySelectorAll('.tpl').forEach((x) => x.setAttribute('aria-pressed', x === b && on));
      const n = on ? b.querySelector('b').textContent : ''; note.textContent = on ? 'Gewählt: Vorlage „' + n + '“.' : 'Noch keine Vorlage gewählt.'; go.textContent = on ? 'Vorlage „' + n + '“ im Builder öffnen' : 'Im Builder öffnen';
      if (msg && (!msg.value || msg.dataset.auto)) { msg.value = on ? 'Ich interessiere mich für die Landingpage-Vorlage „' + n + '“.' : ''; msg.dataset.auto = on ? '1' : ''; } }); })();
  // Produkt-Demo
  (() => { const pm = document.getElementById('pm'), tabs = [...pm.querySelectorAll('.pm-tabs button')], panes = [...pm.querySelectorAll('.pm-pane')]; let last = null, timers = [];
    const clr = () => { timers.forEach(clearTimeout); timers = []; }; const later = (f, ms) => timers.push(setTimeout(f, ms));
    const show = (n) => { tabs.forEach((t, i) => t.setAttribute('aria-selected', i === n)); panes.forEach((p, i) => p.classList.toggle('on', i === n)); clr(); pgSet(n, 0); };
    const PG = panes.map((p) => { const pages = [...p.querySelectorAll('.pg')], nav = p.querySelector('.pgnav'); pages.forEach((pg, k) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = pg.dataset.t; b.setAttribute('role', 'tab'); b.onclick = () => pgSet(panes.indexOf(p), k); nav.appendChild(b); });
      const pr = document.createElement('div'); pr.className = 'pager'; pr.innerHTML = '<button class="btn quiet pgprev" type="button">← Zurück</button><span class="pgct"></span><button class="btn pgnext" type="button">Weiter →</button>'; p.appendChild(pr); return { p, pages, i: 0 }; });
    PG.forEach((s, n) => { s.p.querySelector('.pgprev').onclick = () => pgSet(n, s.i - 1); s.p.querySelector('.pgnext').onclick = () => pgSet(n, s.i + 1); });
    function pgSet(n, i) { const s = PG[n]; if (!s) return; s.i = Math.max(0, Math.min(s.pages.length - 1, i)); s.pages.forEach((pg, k) => pg.classList.toggle('on', k === s.i)); s.p.querySelectorAll('.pgnav button').forEach((b, k) => b.setAttribute('aria-selected', k === s.i)); s.p.querySelector('.pgct').textContent = (s.i + 1) + ' / ' + s.pages.length; s.p.querySelector('.pgprev').disabled = s.i === 0; s.p.querySelector('.pgnext').disabled = s.i === s.pages.length - 1; s.p.querySelector('.pgbody').scrollTop = 0; clr(); }
    pgSet(0, 0);
    const open = (n, from) => { last = from || document.activeElement; show(n); pm.classList.add('open'); document.body.style.overflow = 'hidden'; pm.querySelector('.pm-x').focus(); };
    const close = () => { clr(); pm.classList.remove('open'); document.body.style.overflow = ''; if (last && last.focus) last.focus(); };
    document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('[data-open]'); if (a) { e.preventDefault(); open(+a.dataset.open, a); } });
    document.querySelectorAll('.prod .btn[href="#voice"]').forEach((a) => a.addEventListener('click', () => {}));
    tabs.forEach((t, i) => t.onclick = () => show(i)); pm.querySelector('.pm-x').onclick = close; pm.addEventListener('click', (e) => { if (e.target === pm || e.target.closest('[data-close]')) close(); });
    addEventListener('keydown', (e) => { if (!pm.classList.contains('open')) return; if (e.key === 'Escape') close(); const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'); if (e.target.closest && e.target.closest('input,textarea,select')) return; if (e.key === 'ArrowRight') pgSet(i, PG[i].i + 1); if (e.key === 'ArrowLeft') pgSet(i, PG[i].i - 1); });
    const pick = (id, cb) => { const g = document.getElementById(id); g.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => { g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); cb(i); })); return () => [...g.querySelectorAll('button')].findIndex((b) => b.getAttribute('aria-pressed') === 'true'); };
    // Governance
    const CH = ['Mandant', 'Berechtigung', 'Einwilligung', 'Risiko'], SC = [[1, 1, 0, 0], [1, 1, 1, 1], [1, 1, 1, 2]], TXT = ['Blockiert – keine Einwilligung für Export.', 'Freigegeben – Aktion ausgeführt.', 'Mensch erforderlich – Vier-Augen-Prinzip.'];
    const chk = document.getElementById('g-chk'), gv = document.getElementById('g-v'), gh = document.getElementById('g-h');
    const gReset = () => { clr(); chk.innerHTML = CH.map((c) => '<div>' + c + '</div><span>–</span>').join(''); gv.textContent = ''; gh.textContent = ''; };
    const gSel = pick('g-pick', gReset); gReset();
    document.getElementById('g-run').onclick = () => { gReset(); const s = SC[gSel()], d = [...chk.querySelectorAll('div')], sp = [...chk.querySelectorAll('span')]; let stop = false;
      CH.forEach((c, i) => later(() => { if (stop) return; d[i].className = 'wait'; sp[i].textContent = '…'; later(() => { const r = s[i] === 1 ? 'ok' : s[i] === 0 ? 'no' : 'wait'; d[i].className = r; sp[i].className = r; sp[i].textContent = r === 'ok' ? '✓' : r === 'no' ? '✕' : '!'; if (r !== 'ok') stop = true; }, 380); }, i * 700));
      later(() => { const v = s.includes(0) ? 0 : s.includes(2) ? 2 : 1; gv.textContent = TXT[s.includes(0) ? 0 : s.includes(2) ? 2 : 1]; gh.textContent = 'BEISPIEL · im Produkt entsteht hier ein Evidence-Eintrag'; }, 3300); };
    // Voice
    const CALL = [[['c', 'Hallo, bei mir ist die Heizung ausgefallen – und es riecht nach Gas.'], ['a', 'Hier ist der KI-Assistent von Heizungsbau Rennsteig. Bitte verlassen Sie sofort das Gebäude und rufen Sie die 112.'], ['sys', 'GEFAHR ERKANNT · ÜBERGABE AN BEREITSCHAFT']],
      [['c', 'Ich bräuchte nächste Woche einen Termin.'], ['a', 'Ich bin ein KI-Assistent der Praxis. Terminzusagen kann ich nicht geben – ich notiere Ihren Wunsch und die Praxis ruft zurück.'], ['sys', 'RÜCKRUF NOTIERT · KEINE AUFZEICHNUNG']],
      [['c', 'Habt ihr heute Abend noch einen Tisch für vier?'], ['a', 'Ich bin der KI-Assistent des Hauses. Ich nehme Ihre Anfrage für vier Personen auf – das Team bestätigt Ihnen den Tisch.'], ['sys', 'ANFRAGE AUFGENOMMEN · BESTÄTIGUNG DURCH MENSCH']]];
    const chat = document.getElementById('v-chat'); const vSel = pick('v-pick', () => { clr(); chat.innerHTML = ''; });
    document.getElementById('v-run').onclick = () => { clr(); chat.innerHTML = ''; CALL[vSel()].forEach(([t, x], i) => later(() => { const p = document.createElement('p'); p.className = t; p.textContent = x; chat.appendChild(p); }, i * 1500 + 200)); };
    // Builder
    const BR = [['Ihr Restaurant', 'Speisekarte · Bestellung · Reservierung', ['Speisekarte', 'Kontakt', 'WhatsApp-Bot']], ['Ihr Handwerksbetrieb', 'Meisterbetrieb in Ihrer Region', ['Leistungen', 'Kontakt', 'Notdienst-Bot']], ['Ihre Praxis oder Kanzlei', 'Termin anfragen · Team · Fachgebiete', ['Rechtsgebiete', 'Kontakt', 'Terminbuchung']]];
    const mb = [...document.getElementById('b-mb').children], tog = document.getElementById('b-tog'); const state = [1, 1, 0]; let bi = 0;
    const draw = () => { const b = BR[bi]; document.getElementById('b-h').textContent = b[0]; document.getElementById('b-s').textContent = b[1]; mb.forEach((m, i) => { m.textContent = b[2][i]; m.classList.toggle('on', !!state[i]); }); tog.innerHTML = b[2].map((n, i) => '<button aria-pressed="' + !!state[i] + '" data-i="' + i + '">' + n + '</button>').join(''); };
    tog.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i; state[i] = state[i] ? 0 : 1; draw(); });
    pick('b-pick', (i) => { bi = i; draw(); }); draw();
  })();
  // Onboarding
  const onb = document.getElementById('onb'), tabs = [...onb.querySelectorAll('[role=tab]')], panels = [...onb.querySelectorAll('.onb-body')]; let step = 0;
  const go = (n) => { step = Math.max(0, Math.min(3, n)); tabs.forEach((t, i) => { t.setAttribute('aria-selected', i === step); t.classList.toggle('done', i < step); }); panels.forEach((p, i) => p.classList.toggle('on', i === step));
    const v = (k) => { const b = onb.querySelector('[data-pick="' + k + '"] [aria-pressed="true"]'); return b ? b.textContent : ''; };
    document.getElementById('s-branche').textContent = v('branche'); document.getElementById('s-voice').textContent = v('voice'); document.getElementById('s-kanal').textContent = v('kanal'); };
  tabs.forEach((t, i) => t.onclick = () => go(i));
  onb.querySelectorAll('[data-next]').forEach((b) => b.onclick = () => go(step + 1)); onb.querySelectorAll('[data-prev]').forEach((b) => b.onclick = () => go(step - 1));
  onb.querySelectorAll('.segs').forEach((g) => g.querySelectorAll('button').forEach((b) => b.onclick = () => g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b))));
})();
