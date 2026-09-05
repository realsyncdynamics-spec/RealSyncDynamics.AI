// RETIRED 2026-05-28 for security (manual /tmp deploy, not in repo).
// This endpoint is permanently gone. See docs/runtime/SYSTEMCHECK-2026-05-28.md.
Deno.serve(() =>
  new Response(
    JSON.stringify({ ok: false, error: "Gone — endpoint retired for security." }),
    { status: 410, headers: { "content-type": "application/json" } },
  )
);
