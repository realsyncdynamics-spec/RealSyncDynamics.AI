// content.js — RealSyncDynamicsAI AI Usage Monitor (content script).
//
// Erkennt AI-Nutzung auf den 5 unterstuetzten Vendor-UIs und sendet pro
// Detection-Event eine Telemetry-Message an den Background-Worker.
//
// Architektur:
//   1. Vendor-Identifikation ueber URL-Hostname
//   2. Vendor-spezifische Selektor-Mappings + Submit-Trigger
//   3. PII-Heuristik prueft Prompt-Text vor Send (inline, kein Network-Call)
//   4. Daten-Klassifikation: data_class = personal_data wenn Hits, sonst unknown
//   5. Risk-Level: medium bei PII-Hit + externer-Vendor, sonst low/info
//
// WICHTIG: Wir loggen NICHT den vollen Prompt-Text. Nur Metadaten:
// Token-Schaetzung, ob PII erkannt wurde, wie viele File-Uploads, Vendor.
// Privatsphaere-Default: "log presence, not content".

(() => {
  'use strict';

  // ─── Vendor Identifikation ─────────────────────────────────────────────────

  const HOST = location.hostname;

  function identifyVendor() {
    if (HOST.endsWith('chatgpt.com') || HOST.endsWith('openai.com')) {
      return { vendor: 'openai', model: detectChatGPTModel() };
    }
    if (HOST.endsWith('claude.ai')) {
      return { vendor: 'anthropic', model: detectClaudeModel() };
    }
    if (HOST.includes('copilot.microsoft.com') || HOST.includes('m365.cloud.microsoft')) {
      return { vendor: 'microsoft', model: 'copilot' };
    }
    if (HOST.endsWith('gemini.google.com')) {
      return { vendor: 'google', model: detectGeminiModel() };
    }
    if (HOST.endsWith('perplexity.ai')) {
      return { vendor: 'perplexity', model: detectPerplexityModel() };
    }
    return { vendor: 'unknown', model: 'unknown' };
  }

  // Model-Detection ist best-effort — Selektoren der Vendoren aendern sich,
  // wenn unbekannt fallback auf 'unknown'. Das ist kein kritischer Pfad.
  function detectChatGPTModel() {
    // ChatGPT zeigt Model im Header-Bereich
    const candidate = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
    return candidate?.textContent?.trim() || 'unknown';
  }
  function detectClaudeModel() {
    const candidate = document.querySelector('[data-testid="model-selector-button"]');
    return candidate?.textContent?.trim() || 'unknown';
  }
  function detectGeminiModel() {
    const candidate = document.querySelector('bard-mode-switcher button');
    return candidate?.textContent?.trim() || 'unknown';
  }
  function detectPerplexityModel() {
    return 'unknown'; // Perplexity zeigt Modell nur in Pro-Settings
  }

  // ─── PII-Heuristik ─────────────────────────────────────────────────────────

  // Pattern fuer typische personenbezogene Daten in Prompts. Bewusst
  // konservativ — falsche Positive (z.B. zufaellige Zahlenfolgen) sind OK,
  // weil das Event nur als 'medium risk' markiert wird, nicht geblockt.
  const PII_PATTERNS = [
    { name: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
    { name: 'phone_de', re: /\+?49[\s\-/]?\d[\d\s\-/]{7,}/g },
    { name: 'phone_intl', re: /\+\d{1,3}[\s\-]?\d{4,}[\d\s\-]{4,}/g },
    { name: 'iban', re: /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){3,7}\d{1,4}\b/g },
    { name: 'credit_card', re: /\b(?:\d[ -]*?){13,19}\b/g },
    { name: 'german_tax_id', re: /\b\d{2}[\s/]?\d{3}[\s/]?\d{3}[\s/]?\d{4}\b/g },
    { name: 'date_of_birth', re: /\b(?:0?[1-9]|[12][0-9]|3[01])[./-](?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b/g },
  ];

  function detectPii(text) {
    if (!text || text.length < 5) return { hits: 0, types: [] };
    const hits = [];
    for (const p of PII_PATTERNS) {
      if (p.re.test(text)) {
        hits.push(p.name);
        p.re.lastIndex = 0; // reset stateful regex
      }
    }
    return { hits: hits.length, types: hits };
  }

  // ─── Prompt-Capture (Vendor-agnostisch via Submit-Listener) ────────────────

  function getPromptInputs() {
    // Vendor-uebergreifend: textarea + contenteditable=true innerhalb des
    // Composer-Bereichs. Wir suchen alle und filtern auf sichtbare/aktive.
    const candidates = [
      ...document.querySelectorAll('textarea'),
      ...document.querySelectorAll('[contenteditable="true"]'),
    ];
    return candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 100 && rect.height > 20; // sichtbarer Input
    });
  }

  function readPromptText(el) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value || '';
    }
    return el.textContent || '';
  }

  function approxTokens(text) {
    // Grobe Heuristik: 1 Token ~ 4 Zeichen englisch / ~3 deutsch
    return Math.ceil(text.length / 3.5);
  }

  // ─── Event-Sender ──────────────────────────────────────────────────────────

  function sendAiEvent(payload) {
    try {
      chrome.runtime.sendMessage(
        { type: 'rsd:ai-event', payload },
        // optional callback ignoriert — wir senden fire-and-forget
        () => void chrome.runtime.lastError, // unterdrueckt unhandled-error
      );
    } catch {
      // Service-Worker invalid (bei Extension-Reload) — ignorieren
    }
  }

  // ─── Submit-Detektor ───────────────────────────────────────────────────────

  function classifyForVendor(promptText, vendorInfo) {
    const pii = detectPii(promptText);
    const dataClass = pii.hits > 0 ? 'personal_data' : 'unknown';
    // Externer Vendor + PII -> medium. PII allein bei MS Copilot intern -> low.
    const isExternalVendor = ['openai', 'anthropic', 'google', 'perplexity'].includes(vendorInfo.vendor);
    let riskLevel = 'info';
    if (pii.hits > 0 && isExternalVendor) riskLevel = 'medium';
    else if (pii.hits > 0) riskLevel = 'low';

    return {
      ai_system_id: undefined,
      vendor: vendorInfo.vendor,
      model: vendorInfo.model,
      event_type: 'prompt_sent',
      prompt_category: 'unknown', // Folge-PR: leichte Klassifikation per Keyword
      data_class: dataClass,
      risk_level: riskLevel,
      policy_status: 'logged',
      prompt_tokens: approxTokens(promptText),
      metadata: {
        url: location.origin,
        pii_types: pii.types,
        prompt_length_chars: promptText.length,
      },
      occurred_at: new Date().toISOString(),
    };
  }

  function attachSubmitListeners() {
    // Listen auf 'keydown' Enter (ohne Shift) im Composer + auf Click der
    // Send-Buttons. Vendor-spezifische Selektoren sind brittle, deshalb
    // generischer Fallback ueber form-submit + button[type=submit].
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        const target = e.target;
        if (!target || !(target instanceof HTMLElement)) return;
        // Ist der target ein Composer-Input?
        const inputs = getPromptInputs();
        if (!inputs.includes(target)) return;
        const text = readPromptText(target);
        if (!text.trim()) return;
        const vendorInfo = identifyVendor();
        sendAiEvent(classifyForVendor(text, vendorInfo));
      },
      true,
    );

    // File-Upload-Detektor: jedes <input type=file> change-Event ist ein
    // separater file_upload-Event mit risk_level=medium (potentiell
    // Dokumente mit personenbezogenen Daten).
    document.addEventListener(
      'change',
      (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.type !== 'file') return;
        const fileCount = target.files?.length || 0;
        if (fileCount === 0) return;
        const vendorInfo = identifyVendor();
        const totalSize = Array.from(target.files || []).reduce((s, f) => s + f.size, 0);
        sendAiEvent({
          vendor: vendorInfo.vendor,
          model: vendorInfo.model,
          event_type: 'file_upload',
          prompt_category: 'extraction',
          data_class: 'unknown',
          risk_level: 'medium',
          policy_status: 'logged',
          metadata: {
            url: location.origin,
            file_count: fileCount,
            total_size_bytes: totalSize,
            file_extensions: Array.from(target.files || []).map((f) => f.name.split('.').pop()),
          },
          occurred_at: new Date().toISOString(),
        });
      },
      true,
    );
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────

  function boot() {
    const { vendor } = identifyVendor();
    if (vendor === 'unknown') return; // nicht auf einer Vendor-Seite
    attachSubmitListeners();

    // Session-Start-Event: einmalig pro Tab-Load
    sendAiEvent({
      vendor,
      model: identifyVendor().model,
      event_type: 'session_start',
      prompt_category: 'unknown',
      data_class: 'unknown',
      risk_level: 'info',
      policy_status: 'logged',
      metadata: { url: location.origin, page_title: document.title },
      occurred_at: new Date().toISOString(),
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
