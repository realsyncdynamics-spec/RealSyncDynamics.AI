import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { requireScope } = await import('../src/auth/api-key.js');

/** Minimaler Reply-Ersatz, der nur festhält, was der preHandler gesendet hat. */
function fakeReply() {
  const sent: { status?: number; body?: unknown } = {};
  const reply = {
    code(status: number) {
      sent.status = status;
      return reply;
    },
    send(body: unknown) {
      sent.body = body;
      return reply;
    },
    sent,
  };
  return reply;
}

function fakeRequest(scopes?: string[]) {
  return scopes ? { user: { keyId: 'k', tenantId: 't', scopes } } : {};
}

test('Key mit passendem Scope wird durchgelassen', async () => {
  const reply = fakeReply();
  await requireScope('evidence.read')(
    fakeRequest(['evidence.read']) as never,
    reply as never,
  );
  assert.equal(reply.sent.status, undefined, 'es hätte nichts gesendet werden dürfen');
});

test('Key ohne den Scope wird mit 403 abgewiesen', async () => {
  const reply = fakeReply();
  await requireScope('governance.read')(
    fakeRequest(['evidence.read']) as never,
    reply as never,
  );
  assert.equal(reply.sent.status, 403);
  assert.equal((reply.sent.body as { error: string }).error, 'FORBIDDEN');
});

test('Ein Scope öffnet nicht die übrigen Lesepfade', async () => {
  // Der Kern der Einschränkung: evidence.read darf governance.read nicht
  // mitziehen, sonst ist die Scope-Angabe eines Keys wirkungslos.
  for (const scope of ['governance.read', 'runtime.read']) {
    const reply = fakeReply();
    await requireScope(scope)(fakeRequest(['evidence.read']) as never, reply as never);
    assert.equal(reply.sent.status, 403, `${scope} hätte gesperrt sein müssen`);
  }
});

test('Fehlender Auth-Kontext ergibt 401, nicht 403', async () => {
  const reply = fakeReply();
  await requireScope('evidence.read')(fakeRequest() as never, reply as never);
  assert.equal(reply.sent.status, 401);
});

test('Leere Scope-Liste erlaubt nichts', async () => {
  const reply = fakeReply();
  await requireScope('evidence.read')(fakeRequest([]) as never, reply as never);
  assert.equal(reply.sent.status, 403);
});
