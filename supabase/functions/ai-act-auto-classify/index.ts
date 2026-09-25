// AI Act Auto-Classification Engine
// Classifies a tenant's AI system from its characteristics and writes the
// result to ai_act_assessments (+ ai_systems.latest_assessment_id).
//
// POST /functions/v1/ai-act-auto-classify
// Authorization: Bearer <user JWT>   — a real user session; the anon key and
//                                      the service_role key are rejected (401)
// Body: { tenant_id: uuid, ai_system_id: uuid }
//
// verify_jwt = true (platform default). The platform gate alone is NOT
// authorization: the anon key is a valid project JWT. Authorization is the
// canonical resolver requireAuthAndTenant (_shared/auth.ts): user identity
// via auth.getUser(), membership in tenant_id with role owner|admin (403
// otherwise). The service_role client (auth.admin) only exists after that
// check; the ai_system must belong to the verified tenant (404 otherwise).
// Logic lives in handler.ts / logic.ts, tested in
// test/edge/ai-act-auto-classify-authz.test.ts.

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { jsonError } from '../_shared/gateway.ts';
import { handleAutoClassify } from './handler.ts';

Deno.serve(async (req) => {
  try {
    return await handleAutoClassify(req, { requireAuthAndTenant });
  } catch (e) {
    console.error('[ai-act-auto-classify] unhandled', e);
    return jsonError(500, 'INTERNAL', 'internal error');
  }
});
