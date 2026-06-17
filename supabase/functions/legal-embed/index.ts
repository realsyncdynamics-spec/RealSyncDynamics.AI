// Legal-RAG Embedding Service — batchweise Vektorgenerierung für legal_chunks.
//
// POST /functions/v1/legal-embed
// Auth: Bearer <LEGAL_EMBED_SECRET>  (shared secret, kein User-JWT nötig)
// Body: { batch_size?: number }  default: 50, max: 200
//
// Liest bis zu batch_size Chunks mit NULL-Embedding aus legal_chunks,
// generiert Vektoren via OpenAI text-embedding-3-small (1024 Dimensionen)
// und schreibt embedding + embedding_model zurück.
//
// Idempotent: bereits eingebettete Chunks werden übersprungen.
// Kann wiederholt aufgerufen werden bis remaining=0.
//
// Env-Vars benötigt:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   OPENAI_API_KEY  (aus Vault)
//   LEGAL_EMBED_SECRET  (shared secret für diesen Endpunkt)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS  = 1024;
const OPENAI_BATCH    = 20; // max texts per OpenAI embeddings call

interface EmbeddingResponse {
  data?:  Array<{ embedding?: number[]; index?: number }>;
  model?: string;
  usage?: { prompt_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SECRET = Deno.env.get('LEGAL_EMBED_SECRET');
  if (!SECRET) return jsonError(503, 'NOT_CONFIGURED', 'LEGAL_EMBED_SECRET not set');

  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${SECRET}`) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid embed secret');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const OPENAI_KEY  = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_KEY) return jsonError(503, 'NOT_CONFIGURED', 'OPENAI_API_KEY not set');

  let batchSize = 50;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.batch_size === 'number') {
      batchSize = Math.min(Math.max(Math.floor(body.batch_size), 1), 200);
    }
  } catch { /* ignore */ }

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Lade Chunks mit fehlendem Embedding
  const { data: chunks, error: fetchErr } = await admin
    .from('legal_chunks')
    .select('id, chunk_text')
    .is('embedding', null)
    .limit(batchSize)
    .order('created_at', { ascending: true });

  if (fetchErr) return jsonError(500, 'INTERNAL', fetchErr.message);
  if (!chunks || chunks.length === 0) {
    return json({ ok: true, processed: 0, remaining: 0 });
  }

  let processed = 0;
  const errors: string[] = [];

  // OpenAI-Batch-Embedding (max OPENAI_BATCH Texte pro Call)
  for (let i = 0; i < chunks.length; i += OPENAI_BATCH) {
    const batch = chunks.slice(i, i + OPENAI_BATCH);
    const texts = batch.map((c) => c.chunk_text as string);

    let embeddings: number[][] | null = null;
    try {
      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts, dimensions: EMBEDDING_DIMS }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await resp.json() as EmbeddingResponse;
      if (!resp.ok) {
        errors.push(`OpenAI ${resp.status}: ${data.error?.message ?? 'unknown'}`);
        continue;
      }
      embeddings = (data.data ?? [])
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((d) => d.embedding ?? []);
    } catch (e) {
      errors.push(`OpenAI fetch: ${(e as Error).message}`);
      continue;
    }

    // Schreibe Embeddings zurück
    for (let j = 0; j < batch.length; j++) {
      const vec = embeddings[j];
      if (!vec || vec.length !== EMBEDDING_DIMS) {
        errors.push(`chunk ${batch[j].id}: unexpected embedding dim ${vec?.length}`);
        continue;
      }
      const { error: upErr } = await admin
        .from('legal_chunks')
        .update({ embedding: JSON.stringify(vec), embedding_model: EMBEDDING_MODEL })
        .eq('id', batch[j].id);
      if (upErr) {
        errors.push(`update chunk ${batch[j].id}: ${upErr.message}`);
      } else {
        processed++;
      }
    }
  }

  // Remaining count
  const { count } = await admin
    .from('legal_chunks')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null);

  return json({
    ok:        errors.length === 0,
    processed,
    remaining: count ?? 0,
    errors:    errors.length > 0 ? errors : undefined,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
