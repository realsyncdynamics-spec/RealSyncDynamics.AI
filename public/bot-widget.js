/**
 * RealSync Bot-Widget — läuft auf der Website des Mandanten.
 *
 * Keine Abhängigkeiten, kein Cookie. sessionStorage erst nach der ersten
 * Nachricht (TDDDG: keine Speicherung vor Interaktion). Texte werden
 * escaped, bevor sie ins DOM gehen.
 */
(function () {
  'use strict';

  var host = document.querySelector('[data-rsd-bot]');
  if (!host || host.getAttribute('data-rsd-ready') === '1') return;
  host.setAttribute('data-rsd-ready', '1');

  var tenantId = host.getAttribute('data-tenant') || '';
  var botId = host.getAttribute('data-bot') || '';
  var endpoint = host.getAttribute('data-endpoint') || '';
  var greeting = host.getAttribute('data-greeting') || 'Hallo! Wobei kann ich Ihnen helfen?';
  if (!tenantId || !botId || !endpoint) return;

  var storageKey = 'rsd-bot-ref:' + botId;
  var conversationRef = null;
  var open = false;

  var style = document.createElement('style');
  style.textContent = [
    '.rsd-bot-host{font-family:system-ui,sans-serif;}',
    '.rsd-bot-host>p{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}',
    '.rsd-bot-launcher{position:fixed;right:1.25rem;bottom:1.25rem;z-index:2147483000;',
    'background:#0F766E;color:#F8FAFC;border:0;padding:.85rem 1.15rem;font:600 14px/1 system-ui,sans-serif;',
    'cursor:pointer;box-shadow:0 12px 32px -12px rgba(0,0,0,.4);}',
    '.rsd-bot-launcher:focus-visible{outline:3px solid #0F766E;outline-offset:3px;}',
    '.rsd-bot-panel{position:fixed;right:1.25rem;bottom:4.5rem;z-index:2147483000;width:min(22rem,calc(100vw - 2rem));',
    'max-height:min(28rem,70vh);display:flex;flex-direction:column;background:#F8FAFC;color:#0F172A;',
    'border:1px solid #cbd5e1;box-shadow:0 24px 64px -28px rgba(0,0,0,.38);}',
    '.rsd-bot-panel[hidden]{display:none;}',
    '.rsd-bot-head{padding:.75rem 1rem;border-bottom:1px solid #e2e8f0;font-weight:650;font-size:.9rem;}',
    '.rsd-bot-note{padding:.5rem 1rem;font-size:.72rem;color:#475569;border-bottom:1px solid #e2e8f0;}',
    '.rsd-bot-log{flex:1;overflow:auto;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.5rem;}',
    '.rsd-bot-msg{font-size:.85rem;line-height:1.45;max-width:90%;}',
    '.rsd-bot-msg[data-role="user"]{align-self:flex-end;background:#0F766E;color:#F8FAFC;padding:.45rem .7rem;}',
    '.rsd-bot-msg[data-role="assistant"]{align-self:flex-start;background:#e2e8f0;padding:.45rem .7rem;}',
    '.rsd-bot-form{display:flex;gap:.4rem;padding:.6rem;border-top:1px solid #e2e8f0;}',
    '.rsd-bot-form input{flex:1;border:1px solid #cbd5e1;padding:.55rem .7rem;font:inherit;}',
    '.rsd-bot-form button{background:#0F766E;color:#F8FAFC;border:0;padding:.55rem .9rem;font:600 13px/1 system-ui,sans-serif;cursor:pointer;}',
  ].join('');
  document.head.appendChild(style);

  var launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'rsd-bot-launcher';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'rsd-bot-panel');
  launcher.textContent = 'Chat';

  var panel = document.createElement('div');
  panel.id = 'rsd-bot-panel';
  panel.className = 'rsd-bot-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'KI-Chat');
  panel.hidden = true;
  panel.innerHTML =
    '<div class="rsd-bot-head">Assistent</div>' +
    '<p class="rsd-bot-note">Dieser Chat wird von einem KI-System beantwortet.</p>' +
    '<div class="rsd-bot-log" data-log></div>' +
    '<form class="rsd-bot-form">' +
    '<label class="sr-only" for="rsd-bot-input" style="position:absolute;width:1px;height:1px;overflow:hidden">Nachricht</label>' +
    '<input id="rsd-bot-input" name="message" maxlength="4000" autocomplete="off" />' +
    '<button type="submit">Senden</button></form>';

  host.appendChild(launcher);
  host.appendChild(panel);

  var log = panel.querySelector('[data-log]');
  var form = panel.querySelector('form');
  var input = panel.querySelector('input');

  function addMsg(role, text) {
    var row = document.createElement('div');
    row.className = 'rsd-bot-msg';
    row.setAttribute('data-role', role);
    row.textContent = text;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  addMsg('assistant', greeting);

  function toggle() {
    open = !open;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) input.focus();
  }

  launcher.addEventListener('click', toggle);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && open) toggle();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var message = (input.value || '').trim();
    if (!message) return;
    input.value = '';
    addMsg('user', message);

    if (!conversationRef) {
      try {
        conversationRef = sessionStorage.getItem(storageKey);
      } catch (ignore) {
        conversationRef = null;
      }
      if (!conversationRef) {
        conversationRef = 'web-' + botId.slice(0, 8) + '-' + Math.random().toString(36).slice(2, 10);
        try { sessionStorage.setItem(storageKey, conversationRef); } catch (ignore2) { /* privatmodus */ }
      }
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        bot_id: botId,
        message: message,
        conversation_ref: conversationRef,
      }),
    })
      .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
      .then(function (result) {
        var reply = result.json && result.json.reply;
        addMsg('assistant', reply || 'Gerade keine Antwort. Bitte später erneut versuchen.');
      })
      .catch(function () {
        addMsg('assistant', 'Die Verbindung ist unterbrochen. Bitte später erneut versuchen.');
      });
  });
})();
