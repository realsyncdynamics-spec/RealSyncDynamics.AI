/** Exclusive landing seeds. HTML/CSS/local JS only — no CDN, no React. */

export type LandingTemplateId = "atelier" | "access" | "manifest" | "split";

function landingArtifact(title: string, html: string, css: string, js: string): string {
  return `<boltArtifact title="${title}">
<boltAction type="file" filePath="index.html">
${html}
</boltAction>
<boltAction type="file" filePath="styles.css">
${css}
</boltAction>
<boltAction type="file" filePath="app.js">
${js}
</boltAction>
</boltArtifact>`;
}

const ATELIER_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atelier — nur auf Anfrage</title>
  <meta name="description" content="Ein privater Launch. Kein Feed, keine Demo-Optik." />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <a class="skip" href="#main">Zum Inhalt</a>
  <header class="top">
    <p class="brand">ATELIER</p>
    <nav>
      <a href="#proof">Stand</a>
      <a href="#access">Zugang</a>
    </nav>
  </header>
  <main id="main">
    <section class="hero">
      <p class="eye">Private collection · 2026</p>
      <h1>Nicht für den Feed gebaut.</h1>
      <p class="lede">Eine Seite, eine Handlung, eine Liste. Wer nicht gemeint ist, scrollt vorbei.</p>
      <a class="cta" href="#access">Zugang anfragen</a>
    </section>
    <section id="proof" class="proof">
      <div><strong>12</strong><span>Plätze in diesem Zyklus</span></div>
      <div><strong>EU</strong><span>Daten bleiben in der Region</span></div>
      <div><strong>1</strong><span>CTA — kein Funnel-Theater</span></div>
    </section>
    <section id="access" class="access">
      <h2>Wenn der Satz sitzt.</h2>
      <form id="waitlist" novalidate>
        <label for="email">Arbeitsmail</label>
        <div class="row">
          <input id="email" name="email" type="email" autocomplete="email" required placeholder="name@firma.eu" />
          <button type="submit">Auf die Liste</button>
        </div>
        <p class="hint" id="form-status">Kein Versand, kein Drittanbieter. Bestätigung nur im Fenster.</p>
      </form>
    </section>
  </main>
  <footer>
    <p>Impressum und Datenschutz stehen vor öffentlichem Go-Live. Kein Tracking in dieser Fassung.</p>
  </footer>
  <script src="app.js"></script>
</body>
</html>
`;

const ATELIER_CSS = `:root {
  --bg: #0A0A0B;
  --fg: #E8E6E1;
  --mute: #8A8680;
  --line: #2A2926;
  --accent: #C4A574;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); }
body {
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  min-height: 100dvh;
}
.skip {
  position: absolute; left: -999px; top: 0;
}
.skip:focus { left: 12px; top: 12px; background: var(--fg); color: var(--bg); padding: 8px 12px; }
.top {
  display: flex; justify-content: space-between; align-items: center;
  padding: 28px 8vw; border-bottom: 1px solid var(--line);
}
.brand, nav a, .eye, .hint, footer, label, .proof span {
  font-family: ui-monospace, "IBM Plex Mono", Menlo, monospace;
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--mute);
}
nav { display: flex; gap: 28px; }
nav a { color: var(--mute); text-decoration: none; }
nav a:hover { color: var(--fg); }
.hero { padding: 18vh 8vw 12vh; max-width: 18ch; }
.eye { margin: 0 0 24px; color: var(--accent); }
h1 {
  font-weight: 400; font-size: clamp(42px, 8vw, 92px);
  line-height: 0.92; letter-spacing: -0.03em; margin: 0 0 28px;
}
.lede { font-size: 20px; line-height: 1.45; color: var(--mute); max-width: 28ch; margin: 0 0 40px; }
.cta, button {
  display: inline-flex; align-items: center; min-height: 48px; padding: 0 22px;
  background: var(--fg); color: var(--bg); border: 0; text-decoration: none;
  font-family: ui-monospace, Menlo, monospace; font-size: 12px; letter-spacing: 0.14em;
  text-transform: uppercase; cursor: pointer;
}
.cta:hover, button:hover { background: var(--accent); }
.proof {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
}
.proof div { padding: 32px 8vw 32px 4vw; border-right: 1px solid var(--line); }
.proof div:last-child { border-right: 0; }
.proof strong { display: block; font-size: 28px; font-weight: 400; margin-bottom: 8px; color: var(--fg); }
.access { padding: 12vh 8vw 16vh; max-width: 640px; }
h2 { font-weight: 400; font-size: clamp(28px, 4vw, 44px); margin: 0 0 32px; }
label { display: block; margin-bottom: 10px; }
.row { display: flex; gap: 0; border: 1px solid var(--line); }
input {
  flex: 1; min-height: 48px; border: 0; background: transparent; color: var(--fg);
  padding: 0 16px; font-size: 16px;
}
input:focus { outline: 2px solid var(--accent); outline-offset: -2px; }
.hint { margin-top: 14px; }
.hint.ok { color: var(--accent); }
.hint.err { color: #D27A70; }
footer { padding: 28px 8vw 48px; border-top: 1px solid var(--line); }
@media (max-width: 800px) {
  .proof { grid-template-columns: 1fr; }
  .proof div { border-right: 0; border-bottom: 1px solid var(--line); padding: 24px 8vw; }
  .row { flex-direction: column; }
}
`;

const ATELIER_JS = `const form = document.getElementById("waitlist");
const status = document.getElementById("form-status");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = String(new FormData(form).get("email") || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    status.textContent = "Bitte eine gültige Arbeitsmail.";
    status.className = "hint err";
    return;
  }
  status.textContent = "Notiert. In dieser Vorschau geht nichts an einen Server.";
  status.className = "hint ok";
  form.reset();
});
`;

const ACCESS_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Private Access</title>
  <meta name="description" content="Invite-only. Kapazität begrenzt." />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="frame">
    <p class="eye">Invite only</p>
    <h1>Zwölf Zugänge.<br />Dann ist Schluss.</h1>
    <p class="lede">Keine öffentliche Registrierung. Wer den Satz kennt, schreibt.</p>
    <form id="waitlist">
      <input id="email" name="email" type="email" required placeholder="name@firma.eu" aria-label="E-Mail" />
      <button type="submit">Anfragen</button>
    </form>
    <p class="hint" id="form-status">Kapazität wird nicht auf einer Marketingseite verhandelt.</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const ACCESS_CSS = `:root { --bg:#070708; --fg:#F2F0EA; --mute:#7C7A74; --accent:#0052FF; --line:#1C1C1F; }
* { box-sizing: border-box; }
html, body { margin:0; height:100%; background:var(--bg); color:var(--fg); }
body {
  font-family: ui-sans-serif, "IBM Plex Sans", system-ui, sans-serif;
  display:grid; place-items:center;
}
.frame { width: min(640px, 88vw); }
.eye {
  font-family: ui-monospace, Menlo, monospace; font-size:11px; letter-spacing:0.22em;
  text-transform:uppercase; color:var(--accent); margin:0 0 28px;
}
h1 { font-weight:500; font-size:clamp(40px, 7vw, 72px); line-height:0.95; letter-spacing:-0.04em; margin:0 0 20px; }
.lede { color:var(--mute); font-size:18px; line-height:1.5; max-width:32ch; margin:0 0 36px; }
form { display:flex; border:1px solid var(--line); }
input {
  flex:1; min-height:52px; border:0; background:transparent; color:var(--fg); padding:0 16px; font-size:16px;
}
button {
  min-height:52px; padding:0 22px; border:0; background:var(--accent); color:#fff;
  font-family: ui-monospace, Menlo, monospace; letter-spacing:0.12em; text-transform:uppercase; font-size:11px; cursor:pointer;
}
.hint { margin-top:16px; font-size:12px; color:var(--mute); }
.hint.ok { color:#7DCEA0; }
.hint.err { color:#E24A4A; }
`;

const ACCESS_JS = ATELIER_JS;

const MANIFEST_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Manifest</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <article>
    <p class="eye">RealSyncDynamics · Governance OS</p>
    <h1>Kontrolle vor Geschwindigkeit.</h1>
    <p class="lede">KI im Unternehmen braucht denselben Nachweis wie Buchhaltung: wer, was, warum, unveränderbar.</p>
    <ol>
      <li>Kein Modellaufruf ohne Sitzung und Mandant.</li>
      <li>High-Risk bleibt HOLD, nicht „wir loggen das später“.</li>
      <li>Die Vorschau ist ein Dokument, keine zweite Production.</li>
    </ol>
    <a class="cta" href="#cta">Gespräch anfragen</a>
    <form id="waitlist">
      <input id="email" name="email" type="email" required placeholder="name@firma.eu" aria-label="E-Mail" />
      <button type="submit">Schreiben</button>
    </form>
    <p class="hint" id="form-status">Keine Newsletter-Liste. Eine Anfrage.</p>
  </article>
  <script src="app.js"></script>
</body>
</html>
`;

const MANIFEST_CSS = `:root { --bg:#0A0A0B; --fg:#E2E2E2; --mute:#8B8B8B; --accent:#0052FF; --line:#222; }
* { box-sizing: border-box; }
html, body { margin:0; background:var(--bg); color:var(--fg); }
body { font-family: ui-sans-serif, "IBM Plex Sans", system-ui, sans-serif; }
article { max-width: 720px; padding: 12vh 8vw 20vh; }
.eye { font-family: ui-monospace, Menlo, monospace; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:var(--accent); }
h1 { font-weight:500; font-size:clamp(36px, 6vw, 64px); letter-spacing:-0.03em; line-height:1.02; }
.lede { font-size:20px; color:var(--mute); line-height:1.5; }
ol { padding: 0 0 0 1.1em; color:var(--fg); line-height:1.7; }
.cta, button {
  display:inline-flex; min-height:44px; align-items:center; padding:0 18px; margin: 24px 0 16px;
  background:var(--accent); color:#fff; text-decoration:none; border:0; font-size:13px; cursor:pointer;
}
form { display:flex; max-width:420px; border:1px solid var(--line); }
input { flex:1; min-height:44px; border:0; background:transparent; color:var(--fg); padding:0 12px; }
.hint { font-size:12px; color:var(--mute); }
.hint.ok { color:#7DCEA0; }
.hint.err { color:#E24A4A; }
`;

const MANIFEST_JS = ATELIER_JS;

const SPLIT_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>A/B — Exclusive Launch</title>
  <meta name="description" content="Lokaler A/B-Test. Kein Pixel, kein Server." />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <p class="badge" id="exp-badge">Zuweisung …</p>
  <main>
    <section data-variant="a" hidden>
      <p class="eye">Variante A · Atelier</p>
      <h1>Nicht für den Feed gebaut.</h1>
      <p class="lede">Eine Seite, eine Handlung. Wer nicht gemeint ist, scrollt vorbei.</p>
      <form id="waitlist-a">
        <input name="email" type="email" required placeholder="name@firma.eu" aria-label="E-Mail" />
        <button type="submit">Zugang anfragen</button>
      </form>
    </section>
    <section data-variant="b" hidden>
      <p class="eye">Variante B · Access</p>
      <h1>Zwölf Zugänge. Dann ist Schluss.</h1>
      <p class="lede">Keine öffentliche Registrierung. Wer den Satz kennt, schreibt.</p>
      <form id="waitlist-b">
        <input name="email" type="email" required placeholder="name@firma.eu" aria-label="E-Mail" />
        <button type="submit">Anfragen</button>
      </form>
    </section>
    <p class="hint" id="form-status">50/50 in diesem Fenster. Kein Tracking, kein Workspace-Mandant.</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const SPLIT_CSS = `:root { --bg:#0A0A0B; --fg:#E8E6E1; --mute:#8A8680; --accent:#C4A574; --line:#2A2926; --blue:#0052FF; }
* { box-sizing: border-box; }
html, body { margin:0; background:var(--bg); color:var(--fg); }
body { font-family: ui-sans-serif, "IBM Plex Sans", system-ui, sans-serif; min-height:100dvh; }
.badge {
  font-family: ui-monospace, Menlo, monospace; font-size:11px; letter-spacing:0.16em;
  text-transform:uppercase; margin:0; padding:16px 8vw; border-bottom:1px solid var(--line); color:var(--mute);
}
html[data-variant="a"] .badge { color: var(--accent); }
html[data-variant="b"] .badge { color: var(--blue); }
main { padding: 14vh 8vw 18vh; max-width: 720px; }
.eye { font-family: ui-monospace, Menlo, monospace; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:var(--mute); }
html[data-variant="a"] .eye { color: var(--accent); }
html[data-variant="b"] .eye { color: var(--blue); }
h1 { font-weight:400; font-size:clamp(36px, 7vw, 76px); line-height:0.95; letter-spacing:-0.03em; margin: 12px 0 20px;
  font-family: "Iowan Old Style", Palatino, Georgia, serif; }
.lede { color:var(--mute); font-size:18px; line-height:1.5; max-width:32ch; }
form { display:flex; margin-top:36px; border:1px solid var(--line); max-width:480px; }
input { flex:1; min-height:48px; border:0; background:transparent; color:var(--fg); padding:0 14px; font-size:16px; }
button {
  min-height:48px; padding:0 18px; border:0; cursor:pointer;
  font-family: ui-monospace, Menlo, monospace; font-size:11px; letter-spacing:0.12em; text-transform:uppercase;
}
html[data-variant="a"] button { background: var(--fg); color: var(--bg); }
html[data-variant="b"] button { background: var(--blue); color: #fff; }
.hint { margin-top:16px; font-size:12px; color:var(--mute); }
.hint.ok { color:#7DCEA0; }
.hint.err { color:#E24A4A; }
`;

const SPLIT_JS = `function pickVariant() {
  const forced = (location.hash || "").replace("#", "").toLowerCase();
  if (forced === "a" || forced === "b") return forced;
  const n = crypto.getRandomValues(new Uint8Array(1))[0];
  return n % 2 === 0 ? "a" : "b";
}
const variant = pickVariant();
document.documentElement.dataset.variant = variant;
const badge = document.getElementById("exp-badge");
if (badge) {
  badge.textContent = "Variante " + variant.toUpperCase() + " · 50/50 lokal · kein Pixel · Hash #a oder #b erzwingt";
}
document.querySelectorAll("[data-variant]").forEach((node) => {
  node.hidden = node.getAttribute("data-variant") !== variant;
});
function bind(form) {
  const status = document.getElementById("form-status");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = String(new FormData(form).get("email") || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = "Bitte eine gültige Arbeitsmail.";
      status.className = "hint err";
      return;
    }
    status.textContent = "Variante " + variant.toUpperCase() + " · notiert, kein Server.";
    status.className = "hint ok";
    form.reset();
  });
}
bind(document.getElementById("waitlist-a"));
bind(document.getElementById("waitlist-b"));
`;

export const LANDING_TEMPLATES: Record<
  LandingTemplateId,
  { title: string; prompt: string; artifact: string }
> = {
  atelier: {
    title: "Atelier",
    prompt: "Exklusive Launch-Seite: Manifest, eine Handlung, keine Demo-Optik.",
    artifact: landingArtifact("Atelier", ATELIER_HTML, ATELIER_CSS, ATELIER_JS),
  },
  access: {
    title: "Private Access",
    prompt: "Invite-only Waitlist. Eine E-Mail, ein Satz Kapazität, kein Marketing-Lärm.",
    artifact: landingArtifact("Private Access", ACCESS_HTML, ACCESS_CSS, ACCESS_JS),
  },
  manifest: {
    title: "Manifest",
    prompt: "Editorial Manifest für ein Governance-Produkt. Beweiszeile, eine CTA.",
    artifact: landingArtifact("Manifest", MANIFEST_HTML, MANIFEST_CSS, MANIFEST_JS),
  },
  split: {
    title: "A/B-Test",
    prompt: "Lokaler A/B-Test zweier exklusiver Landings. 50/50 im Fenster, kein Pixel, kein Mandanten-Slot.",
    artifact: landingArtifact("A/B-Test", SPLIT_HTML, SPLIT_CSS, SPLIT_JS),
  },
};

