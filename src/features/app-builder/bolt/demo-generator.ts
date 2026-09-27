/**
 * Deterministic local generator for the workbench demo.
 *
 * Does not call an LLM and does not mock a "successful deploy".
 * It emits bolt.diy protocol so the parser/runner/gate can be exercised
 * without production AI credentials.
 */

export function generateBoltArtifact(prompt: string): string {
  const title = titleFrom(prompt);
  const heading = escape(title);
  const claim = escape(prompt.trim().slice(0, 180) || 'Governed preview');

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="top">
    <span class="mark">RSD</span>
    <span class="meta">PREVIEW · KEIN DEPLOY</span>
  </header>
  <main>
    <p class="kicker">RealSync Code Engine</p>
    <h1>${heading}</h1>
    <p class="lead">${claim}</p>
    <dl>
      <div><dt>Mandant</dt><dd>aus Sitzung, nie aus der URL</dd></div>
      <div><dt>Prüfpfad</dt><dd>jede Dateiaktion wird gehasht</dd></div>
      <div><dt>Vorschau</dt><dd>sandbox srcDoc · kein Netz</dd></div>
    </dl>
  </main>
</body>
</html>
`;

  const css = `:root { --obsidian:#0A0A0B; --titanium:#E2E2E2; --blue:#0052FF; }
* { box-sizing:border-box; margin:0; }
html,body { background:var(--obsidian); color:var(--titanium); font-family: "IBM Plex Sans", system-ui, sans-serif; }
.top { display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid #222; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; }
.mark { color:var(--blue); font-weight:700; }
main { padding:48px 24px; max-width:720px; }
.kicker { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--blue); margin-bottom:16px; }
h1 { font-size:40px; letter-spacing:-0.03em; line-height:1.1; font-weight:500; }
.lead { margin-top:20px; color:#b8b8bc; line-height:1.5; }
dl { margin-top:40px; display:grid; gap:16px; }
dl div { border-top:1px solid #222; padding-top:12px; }
dt { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:#7c7c82; }
dd { margin-top:6px; }
`;

  const readme = `# ${title}

Erzeugt von der RealSync bolt.diy-Engine. Kein Live-Deploy.
Prompt: ${prompt.trim() || '(leer)'}
`;

  return [
    `Plan: Dateibaum erzeugen, Vorschau sandboxed rendern, Prüfpfad schreiben.`,
    `<boltArtifact title="${heading}">`,
    `<boltAction type="file" filePath="index.html">`,
    html,
    `</boltAction>`,
    `<boltAction type="file" filePath="styles.css">`,
    css,
    `</boltAction>`,
    `<boltAction type="file" filePath="README.md">`,
    readme,
    `</boltAction>`,
    `</boltArtifact>`,
  ].join('\n');
}

function titleFrom(prompt: string): string {
  const t = prompt.trim().split(/[\n.!?]/)[0] ?? '';
  if (t.length >= 8) return t.slice(0, 64);
  return 'Governed Preview';
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
