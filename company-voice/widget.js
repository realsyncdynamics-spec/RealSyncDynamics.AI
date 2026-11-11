import { answerCompanyQuestion, curatedFacts, DISCLAIMER, selectVoiceOutput } from './logic.js';

const NOTICE =
  'Das Mikrofon startet erst nach diesem Hinweis. Die Spracheingabe nutzt die Web-Speech-Schnittstelle des Browsers. Der Browserhersteller kann die Aufnahme verarbeiten. Diese Seite speichert kein Audio, kein Transkript und setzt dafür kein Tracking. Sie können stattdessen tippen.';

const INTRO =
  'Demo. Fragen zu RealSyncDynamics.AI beantworte ich nur aus freigegebenen Unternehmensinfos. Keine Rechtsberatung und keine Konformitätszusage. Tippen Sie eine Frage, oder nutzen Sie das Mikrofon nach dem Hinweis.';

const BETA = { publicBeta: true, betaEndsLabel: '31. Januar 2027' };

function microphoneAllowed() {
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (!policy?.allowsFeature) return true;
  try {
    return policy.allowsFeature('microphone');
  } catch {
    return true;
  }
}

function recognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function mountCompanyVoice(doc = document) {
  if (doc.getElementById('company-voice-dialog') || doc.querySelector('[data-testid="company-voice-launcher"]')) return;
  const voice = selectVoiceOutput();
  const style = doc.createElement('style');
  style.textContent = `
    .cv-launcher,.cv-panel button,.cv-panel input{font:inherit;color:inherit}
    .cv-launcher{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:80;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid #3a342c;background:#14120f;color:#f3f2f2;cursor:pointer}
    .cv-badge{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d6ad68}
    .cv-panel{position:fixed;z-index:90;left:16px;bottom:calc(72px + env(safe-area-inset-bottom));display:flex;flex-direction:column;width:min(420px,calc(100vw - 32px));max-height:min(70dvh,640px);overflow:hidden;border:1px solid #3a342c;background:#14120f;color:#f3f2f2}
    .cv-head,.cv-note,.cv-form{padding:12px 14px;border-bottom:1px solid #3a342c}
    .cv-head{display:flex;justify-content:space-between;gap:12px}
    .cv-title{margin:4px 0 0;font-family:Georgia,serif;font-size:22px;font-weight:400}
    .cv-meta,.cv-note,.cv-status{font-family:ui-monospace,monospace;font-size:12px;line-height:1.45;color:#b7b0a4}
    .cv-log{flex:1 1 auto;min-height:0;overflow:auto;margin:0;padding:12px 14px;list-style:none;display:flex;flex-direction:column;gap:10px}
    .cv-log span{display:block;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#b7b0a4}
    .cv-form{display:flex;flex-wrap:wrap;gap:8px;border-bottom:0;border-top:1px solid #3a342c}
    .cv-form input{flex:1 1 180px;min-height:44px;padding:0 10px;border:1px solid #3a342c;background:transparent;color:inherit}
    .cv-panel button{min-height:44px;padding:0 12px;border:1px solid #3a342c;background:transparent;color:inherit;cursor:pointer}
    .cv-form button[type="submit"]{border-color:#d6ad68;background:#8a6a32;color:#fffdf6}
    .cv-panel button:disabled{opacity:.55;cursor:not-allowed}
    .cv-panel :focus-visible,.cv-launcher:focus-visible{outline:2px solid #d6ad68;outline-offset:2px}
    @media (max-width:640px){.cv-panel{left:0;right:0;bottom:0;width:100%;max-height:85dvh}}
  `;
  doc.head.appendChild(style);

  const launcher = doc.createElement('button');
  launcher.type = 'button';
  launcher.className = 'cv-launcher';
  launcher.setAttribute('data-testid', 'company-voice-launcher');
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'company-voice-dialog');
  launcher.innerHTML = '<span class="cv-badge">Demo</span><span>Fragen</span>';
  doc.body.appendChild(launcher);

  let noticeAccepted = false;
  let recognition = null;
  const facts = curatedFacts();
  const canSpeak = recognitionCtor() !== null && microphoneAllowed();
  const micBlocked = !microphoneAllowed();

  function speak(text) {
    if (voice.engine !== 'web-speech' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    window.speechSynthesis.speak(utterance);
  }

  function close(panel) {
    recognition?.abort();
    recognition = null;
    window.speechSynthesis?.cancel();
    panel.remove();
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', () => {
    if (doc.getElementById('company-voice-dialog')) return;
    launcher.setAttribute('aria-expanded', 'true');
    const panel = doc.createElement('div');
    panel.id = 'company-voice-dialog';
    panel.className = 'cv-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'company-voice-title');
    panel.setAttribute('data-testid', 'company-voice-panel');
    panel.innerHTML = `
      <div class="cv-head">
        <div><span class="cv-badge">Demo</span><h2 id="company-voice-title" class="cv-title">Fragen zum Unternehmen</h2><p class="cv-meta">Quelle: kuratierte Fakten</p></div>
        <button type="button" data-close>Schließen</button>
      </div>
      <p class="cv-note"></p>
      <ol class="cv-log" aria-live="polite" aria-label="Transkript"></ol>
      <div class="cv-note" data-notice></div>
      <form class="cv-form">
        <input aria-label="Frage als Text" maxlength="500" data-testid="company-voice-input" />
        <button type="submit">Antwort anzeigen</button>
        <button type="button" data-mic hidden>Sprechen</button>
        <p class="cv-status" data-mic-fallback hidden></p>
        <button type="button" data-stop>Vorlesen stoppen</button>
      </form>`;
    panel.querySelector('.cv-note').textContent = DISCLAIMER;
    const log = panel.querySelector('.cv-log');
    const notice = panel.querySelector('[data-notice]');
    const input = panel.querySelector('input');
    const mic = panel.querySelector('[data-mic]');
    const fallback = panel.querySelector('[data-mic-fallback]');

    function addTurn(role, text, link) {
      const item = doc.createElement('li');
      const label = doc.createElement('span');
      label.textContent = role === 'user' ? 'Sie' : 'Untertitel';
      item.appendChild(label);
      item.appendChild(doc.createTextNode(text));
      if (link?.href?.startsWith('/')) {
        item.appendChild(doc.createTextNode(' '));
        const anchor = doc.createElement('a');
        anchor.href = link.href;
        anchor.textContent = link.label;
        item.appendChild(anchor);
      }
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;
    }

    function renderNotice() {
      notice.textContent = '';
      const paragraph = doc.createElement('p');
      paragraph.textContent = noticeAccepted
        ? 'Mikrofon nur für diese Sitzung. Kein Audio wird gespeichert.'
        : NOTICE;
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = noticeAccepted ? 'Hinweis gelesen' : 'Hinweis gelesen, Mikrofon freigeben';
      button.disabled = noticeAccepted;
      button.addEventListener('click', () => {
        noticeAccepted = true;
        renderNotice();
        if (canSpeak) mic.disabled = false;
      });
      notice.append(paragraph, button);
    }

    function ask(raw) {
      const question = raw.trim().slice(0, 500);
      if (!question) return;
      const result = answerCompanyQuestion(question, facts, BETA);
      addTurn('user', question);
      addTurn('assistant', result.text, result.link);
      input.value = '';
      speak(result.text);
    }

    addTurn('assistant', INTRO);
    renderNotice();
    if (canSpeak && !micBlocked) {
      mic.hidden = false;
      mic.disabled = !noticeAccepted;
      mic.addEventListener('click', () => {
        if (!noticeAccepted) return;
        if (recognition) {
          recognition.abort();
          recognition = null;
          mic.textContent = 'Sprechen';
          mic.setAttribute('aria-pressed', 'false');
          return;
        }
        const Ctor = recognitionCtor();
        if (!Ctor) return;
        recognition = new Ctor();
        recognition.lang = 'de-DE';
        recognition.interimResults = false;
        recognition.continuous = false;
        recognition.onresult = (event) => {
          const said = event.results?.[0]?.[0]?.transcript || '';
          if (said.trim()) ask(said);
        };
        recognition.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            fallback.hidden = false;
            fallback.textContent = 'Spracheingabe ist auf dieser Seite gesperrt. Bitte tippen.';
            mic.hidden = true;
          }
          recognition = null;
          mic.textContent = 'Sprechen';
        };
        recognition.onend = () => {
          recognition = null;
          mic.textContent = 'Sprechen';
          mic.setAttribute('aria-pressed', 'false');
        };
        try {
          recognition.start();
          mic.textContent = 'Zuhören beenden';
          mic.setAttribute('aria-pressed', 'true');
        } catch {
          recognition = null;
        }
      });
    } else {
      fallback.hidden = false;
      fallback.textContent = micBlocked
        ? 'Spracheingabe ist auf dieser Seite gesperrt. Bitte tippen.'
        : 'Dieser Browser hat keine Spracheingabe. Bitte tippen.';
    }

    panel.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      ask(input.value);
    });
    panel.querySelector('[data-stop]').addEventListener('click', () => window.speechSynthesis?.cancel());
    panel.querySelector('[data-close]').addEventListener('click', () => close(panel));
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(panel);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    doc.body.appendChild(panel);
    panel.querySelector('[data-close]').focus();
  });
}

window.__mountCompanyVoice = () => mountCompanyVoice(document);
