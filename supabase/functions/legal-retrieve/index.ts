// Legal-RAG Tenant-Retrieval — JWT-gesicherter Suchendpunkt für /app/legal-rag.
//
// POST /functions/v1/legal-retrieve
// Authorization: Bearer <user JWT>
// Body: {
//   tenant_id:   uuid,
//   query:       string,
//   top_k?:      number (1–10, default 5),
//   framework?:  LegalFramework,
//   jurisdiction?: LegalJurisdiction,
// }
//
// Pipeline:
//   1. JWT verify + tenant membership check
//   2. Optionale Query-Embedding-Generierung via OpenAI (wenn OPENAI_API_KEY gesetzt)
//   3. retrieveLegalContext (hybrid wenn embedding verfügbar, sonst FTS)
//   4. Return results mit Citations + Platform-Disclaimer

import { createClient }        from 'jsr:@supabase/supabase-js@2';
import {
  retrieveLegalContext,
  LEGAL_PLATFORM_DISCLAIMER,
  type LegalFramework,
  type LegalJurisdiction,
} from '../_shared/legal-retrieval.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS  = 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK               = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const OPENAI_KEY        = Deno.env.get('OPENAI_API_KEY');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth:   { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: {
    tenant_id?:    string;
    query?:        string;
    top_k?:        number;
    framework?:    LegalFramework;
    jurisdiction?: LegalJurisdiction;
  };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (!body.tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!body.query?.trim()) return jsonError(400, 'BAD_REQUEST', 'query required');

  const { data: member, error: memberErr } = await userClient
    .from('memberships').select('id')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Optionale Query-Embedding-Generierung (aktiviert Hybrid-Retrieval)
  let queryEmbedding: number[] | null = null;
  if (OPENAI_KEY) {
    try {
      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model:      EMBEDDING_MODEL,
          input:      body.query.trim(),
          dimensions: EMBEDDING_DIMS,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) {
        const data = await resp.json();
        queryEmbedding = data?.data?.[0]?.embedding ?? null;
      }
    } catch {
      // Embedding-Fehler sind nicht fatal — fällt auf FTS zurück
    }
  }

  try {
    const result = await retrieveLegalContext(admin, {
      query:           body.query.trim(),
      top_k:           body.top_k,
      framework:       body.framework,
      jurisdiction:    body.jurisdiction,
      caller_type:     'tenant',
      caller_ref:      userId,
      tenant_id:       body.tenant_id,
      query_embedding: queryEmbedding,
    });

    return json({
      ok:                 true,
      query:              result.query,
      retrieved_at:       result.retrieved_at,
      log_id:             result.log_id,
      search_mode:        queryEmbedding ? 'hybrid' : 'fts',
      platform_disclaimer: LEGAL_PLATFORM_DISCLAIMER,
      results:            result.results.map((r) => ({
        heading:          r.heading_path,
        chunk_text:       r.chunk_text,
        framework:        r.framework,
        jurisdiction:     r.jurisdiction,
        title:            r.title,
        source_url:       r.source_url,
        citation_anchor:  r.citation_anchor,
        source_identifier: r.source_identifier,
        published_at:     r.published_at,
        rank_score:       r.rank_score,
        disclaimer:       r.disclaimer,
      })),
    });
  } catch (e) {
    console.error('retrieveLegalContext failed', (e as Error).message);
    return jsonError(500, 'RETRIEVAL_FAILED', (e as Error).message);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
