// ─────────────────────────────────────────────────────────────────────────────
// Stripe Cutover-Tool — idempotentes Setup für TEST und LIVE.
//
// Ersetzt die manuellen Phasen "Produkte anlegen", "Webhook verdrahten" und
// "products-Tabelle mit echten Price-IDs befüllen" aus dem Stripe-Runbook.
// Dieselbe Datei läuft identisch gegen sk_test und sk_live — Idempotenz über
//   • Produkt:  metadata['plan_key']  (Search)
//   • Price:    lookup_key            (List)
//   • Webhook:  url                   (List)
//
// Quelle der Wahrheit für die Tarife: scripts/stripe-plans.json
//
// Verwendung:
//   node scripts/stripe-setup.mjs --mode test            # TEST anlegen
//   node scripts/stripe-setup.mjs --mode test --dry-run  # nur anzeigen
//   node scripts/stripe-setup.mjs --mode test --sql      # products-Seed-SQL
//   node scripts/stripe-setup.mjs --mode test --mapping-md
//   node scripts/stripe-setup.mjs --mode live --confirm-live
//
// Keys (NIEMALS committen, via .env / Vault):
//   STRIPE_SECRET_KEY_TEST  bzw.  STRIPE_SECRET_KEY_LIVE   (bevorzugt)
//   STRIPE_SECRET_KEY                                       (Fallback, beide Modi)
//
// Webhook-Ziel-URL (Reihenfolge): --webhook-url  >  SUPABASE_FUNCTIONS_URL
//   >  abgeleitet aus SUPABASE_URL / VITE_SUPABASE_URL + plans.webhook.pathSuffix
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── reine Helfer (unit-getestet, ohne Stripe-/Netzwerk-Abhängigkeit) ─────────

/** Minimaler CLI-Parser für die unterstützten Flags. */
export function parseArgs(argv) {
  const args = {
    mode: 'test',
    dryRun: false,
    sql: false,
    mappingMd: false,
    confirmLive: false,
    noWebhook: false,
    webhookUrl: null,
    plansPath: resolve(__dirname, 'stripe-plans.json'),
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--mode': args.mode = argv[++i]; break;
      case '--dry-run': args.dryRun = true; break;
      case '--sql': args.sql = true; break;
      case '--mapping-md': args.mappingMd = true; break;
      case '--confirm-live': args.confirmLive = true; break;
      case '--no-webhook': args.noWebhook = true; break;
      case '--webhook-url': args.webhookUrl = argv[++i]; break;
      case '--plans': args.plansPath = resolve(process.cwd(), argv[++i]); break;
      case '-h': case '--help': args.help = true; break;
      default:
        throw new Error(`Unbekanntes Argument: ${a} (--help für Hilfe)`);
    }
  }
  if (args.mode !== 'test' && args.mode !== 'live') {
    throw new Error(`--mode muss "test" oder "live" sein, war: ${args.mode}`);
  }
  return args;
}

/**
 * Wählt den Secret-Key für den Modus und stellt sicher, dass Key-Präfix und
 * Modus zusammenpassen — verhindert versehentliches Anlegen in LIVE mit
 * Test-Key (oder umgekehrt).
 */
export function resolveSecretKey(mode, env) {
  const perMode = mode === 'live' ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY_TEST;
  const key = perMode || env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      `Kein Stripe-Key gefunden. Setze STRIPE_SECRET_KEY_${mode.toUpperCase()} ` +
      `(oder STRIPE_SECRET_KEY) in der Umgebung / .env.`,
    );
  }
  const expectedPrefix = mode === 'live' ? 'sk_live_' : 'sk_test_';
  // rk_ (restricted keys) erlauben wir ebenfalls, mit passendem Modus-Infix.
  const okSk = key.startsWith(expectedPrefix);
  const okRk = key.startsWith(mode === 'live' ? 'rk_live_' : 'rk_test_');
  if (!okSk && !okRk) {
    throw new Error(
      `Key passt nicht zum Modus "${mode}": erwartet Präfix "${expectedPrefix}", ` +
      `bekommen "${key.slice(0, 8)}…". Abbruch zur Sicherheit.`,
    );
  }
  return key;
}

/** Voll qualifizierte Webhook-URL ermitteln (Flag > Env > abgeleitet). */
export function resolveWebhookUrl(args, env, pathSuffix) {
  if (args.webhookUrl) return args.webhookUrl;
  if (env.SUPABASE_FUNCTIONS_URL) {
    return env.SUPABASE_FUNCTIONS_URL.replace(/\/+$/, '') +
      (env.SUPABASE_FUNCTIONS_URL.includes('/functions/') ? '' : pathSuffix);
  }
  const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (base && /^https?:\/\//.test(base) && !base.includes('MY_SUPABASE_URL')) {
    return base.replace(/\/+$/, '') + pathSuffix;
  }
  return null;
}

/** lookup_key-Konvention: recurring → <key>_monthly, one-time → <key>. */
export function lookupKeyFor(plan) {
  if (plan.stripe === false) return null;
  return plan.interval ? `${plan.key}_${plan.interval}ly` : plan.key;
}

/** Markdown-Mapping-Tabelle aus den aufgelösten Zeilen. */
export function renderMappingMarkdown(rows, mode) {
  const head =
    `# Stripe Mapping — ${mode.toUpperCase()}\n\n` +
    `| plan_key | Name | Typ | Betrag | product_id | price_id | lookup_key |\n` +
    `|---|---|---|---|---|---|---|\n`;
  const body = rows.map((r) => {
    const betrag = r.amount == null
      ? '—'
      : `${(r.amount / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` +
        (r.interval ? `/${r.interval === 'month' ? 'Mt.' : r.interval}` : '');
    return `| \`${r.key}\` | ${r.name} | ${r.type} | ${betrag} | ` +
      `\`${r.productId ?? '—'}\` | \`${r.priceId}\` | ${r.lookupKey ? `\`${r.lookupKey}\`` : '—'} |`;
  }).join('\n');
  return head + body + '\n';
}

/**
 * Idempotentes products-Seed-SQL für public.products (von stripe-checkout
 * genutzt). Sentinels behalten ihre internal_default_*-IDs, reale Pläne
 * bekommen die in Stripe aufgelöste Price-ID.
 */
export function renderSeedSql(rows, mode) {
  const values = rows.map((r) =>
    `    ('${r.priceId}', '${r.name.replace(/'/g, "''")}', '${r.key}')`,
  ).join(',\n');
  return (
    `-- Auto-generiert von scripts/stripe-setup.mjs (--mode ${mode}) — idempotent.\n` +
    `-- Im Supabase-SQL-Editor ausführen ODER als Migration committen.\n` +
    `INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES\n` +
    `${values}\n` +
    `ON CONFLICT (stripe_price_id) DO NOTHING;\n`
  );
}

const HELP = `Stripe Cutover-Tool (idempotent)

  --mode test|live      Ziel-Modus (default: test)
  --dry-run             nichts schreiben, nur anzeigen, was passieren würde
  --sql                 products-Seed-SQL für stripe-checkout ausgeben
  --mapping-md          Mapping-Tabelle als Markdown ausgeben
  --confirm-live        Pflicht für schreibende LIVE-Läufe (Sicherheits-Gate)
  --no-webhook          Webhook-Endpoint-Schritt überspringen
  --webhook-url <url>   Webhook-Ziel-URL überschreiben
  --plans <pfad>        alternative Plan-Config (default: scripts/stripe-plans.json)
  -h, --help            diese Hilfe

Keys via Env/.env: STRIPE_SECRET_KEY_TEST / STRIPE_SECRET_KEY_LIVE / STRIPE_SECRET_KEY
`;

// ── Stripe-Operationen (idempotent) ──────────────────────────────────────────

async function ensureProduct(stripe, plan, dryRun) {
  const found = await stripe.products.search({
    query: `metadata['plan_key']:'${plan.key}'`,
  });
  if (found.data[0]) return { product: found.data[0], created: false };
  if (dryRun) return { product: { id: '(dry-run:new-product)' }, created: true };
  const product = await stripe.products.create({
    name: plan.name,
    metadata: { plan_key: plan.key },
  });
  return { product, created: true };
}

async function ensurePrice(stripe, plan, productId, lookupKey, dryRun) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const recurring = plan.interval ? { interval: plan.interval } : undefined;
  const prev = existing.data[0];

  if (prev) {
    const sameAmount = prev.unit_amount === plan.amount;
    const sameInterval = (prev.recurring?.interval ?? null) === (plan.interval ?? null);
    if (sameAmount && sameInterval) return { price: prev, created: false, moved: false };
    // Stripe-Prices sind unveränderlich: neuen Price anlegen und lookup_key
    // übertragen, alten archivieren.
    if (dryRun) return { price: { id: '(dry-run:new-price)' }, created: true, moved: true };
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.amount,
      currency: plan.currency || 'eur',
      ...(recurring ? { recurring } : {}),
      lookup_key: lookupKey,
      transfer_lookup_key: true,
    });
    return { price, created: true, moved: true };
  }

  if (dryRun) return { price: { id: '(dry-run:new-price)' }, created: true, moved: false };
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.amount,
    currency: plan.currency || 'eur',
    ...(recurring ? { recurring } : {}),
    lookup_key: lookupKey,
  });
  return { price, created: true, moved: false };
}

async function ensureWebhook(stripe, url, events, dryRun) {
  const list = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = list.data.find((w) => w.url === url);
  if (existing) {
    const missing = events.filter((e) => !existing.enabled_events.includes(e));
    if (missing.length && !dryRun) {
      await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: Array.from(new Set([...existing.enabled_events, ...events])),
      });
    }
    return { endpoint: existing, created: false, updatedEvents: missing };
  }
  if (dryRun) return { endpoint: { id: '(dry-run:new-webhook)', secret: null }, created: true, updatedEvents: [] };
  const endpoint = await stripe.webhookEndpoints.create({ url, enabled_events: events });
  return { endpoint, created: true, updatedEvents: [] };
}

// ── Orchestrierung ───────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(HELP); return; }

  // .env optional laden (dotenv ist vorhanden), Env hat Vorrang.
  try {
    const { config } = await import('dotenv');
    config();
  } catch { /* dotenv optional */ }

  const plans = JSON.parse(readFileSync(args.plansPath, 'utf8'));
  const key = resolveSecretKey(args.mode, process.env);

  if (args.mode === 'live' && !args.dryRun && !args.confirmLive) {
    throw new Error(
      'LIVE-Schreiblauf ohne --confirm-live abgebrochen. ' +
      'Erst mit --dry-run prüfen, dann --confirm-live setzen.',
    );
  }

  let Stripe;
  try {
    // Variabler Specifier: hält das optionale Paket aus der statischen
    // Modul-Analyse von Bundlern/Test-Runnern heraus.
    const stripePkg = 'stripe';
    ({ default: Stripe } = await import(stripePkg));
  } catch {
    throw new Error(
      'Paket "stripe" nicht installiert. Bitte `npm install` ausführen ' +
      '(stripe steht in devDependencies).',
    );
  }
  const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

  const tag = `${args.mode.toUpperCase()}${args.dryRun ? ' · DRY-RUN' : ''}`;
  console.error(`▶ Stripe-Setup [${tag}]  Plan-Config: ${args.plansPath}`);

  const rows = [];
  for (const plan of plans.plans) {
    // Sentinel-Pläne: kein Stripe-Call, nur Seed-Zeile.
    if (plan.stripe === false) {
      rows.push({
        key: plan.key, name: plan.name, type: 'sentinel',
        amount: null, interval: null, productId: null,
        priceId: plan.sentinelPriceId, lookupKey: null,
      });
      console.error(`  • ${plan.key.padEnd(12)} sentinel → ${plan.sentinelPriceId}`);
      continue;
    }

    const { product, created: pCreated } = await ensureProduct(stripe, plan, args.dryRun);
    const lookupKey = lookupKeyFor(plan);
    const { price, created: prCreated, moved } = await ensurePrice(
      stripe, plan, product.id, lookupKey, args.dryRun,
    );
    rows.push({
      key: plan.key, name: plan.name,
      type: plan.interval ? 'recurring' : 'one_time',
      amount: plan.amount, interval: plan.interval || null,
      productId: product.id, priceId: price.id, lookupKey,
    });
    const flags = [pCreated && 'product:neu', prCreated && (moved ? 'price:ersetzt' : 'price:neu')]
      .filter(Boolean).join(' ') || 'unverändert';
    console.error(`  • ${plan.key.padEnd(12)} ${product.id}  ${price.id}  [${flags}]`);
  }

  // Webhook
  let webhookSecret = null;
  if (!args.noWebhook) {
    const url = resolveWebhookUrl(args, process.env, plans.webhook.pathSuffix);
    if (!url) {
      console.error(
        '  ! Keine Webhook-URL auflösbar (weder --webhook-url noch SUPABASE_FUNCTIONS_URL/' +
        'SUPABASE_URL gesetzt) — Webhook-Schritt übersprungen.',
      );
    } else {
      const { endpoint, created, updatedEvents } = await ensureWebhook(
        stripe, url, plans.webhook.events, args.dryRun,
      );
      webhookSecret = endpoint.secret || null;
      const state = created ? 'neu angelegt'
        : updatedEvents.length ? `Events ergänzt (${updatedEvents.length})` : 'unverändert';
      console.error(`  • webhook       ${url}  [${state}]`);
      if (webhookSecret) {
        console.error(`  ⇒ Webhook-Secret (→ Supabase STRIPE_WEBHOOK_SECRET): ${webhookSecret}`);
      } else if (!created) {
        console.error('    (Secret bei bestehenden Endpoints nicht erneut abrufbar — im Dashboard prüfen.)');
      }
    }
  }

  // Optionale Ausgaben auf stdout (pipe-freundlich getrennt von der Log-Spur).
  if (args.mappingMd) process.stdout.write('\n' + renderMappingMarkdown(rows, args.mode));
  if (args.sql) process.stdout.write('\n' + renderSeedSql(rows, args.mode));

  if (!args.mappingMd && !args.sql) {
    console.error('\nFertig. Tipp: --mapping-md für die Tabelle, --sql für das products-Seed-SQL.');
  }
}

// Nur ausführen, wenn direkt aufgerufen (nicht beim Import durch Tests).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(`\n✖ ${err.message}`);
    process.exit(1);
  });
}
