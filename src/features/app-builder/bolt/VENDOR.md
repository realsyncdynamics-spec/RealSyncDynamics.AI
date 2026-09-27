# Vendor notice — bolt.diy protocol

The streaming artifact protocol (`<boltArtifact>`, `<boltAction type="file|shell|start|build|supabase">`)
and the production-ready mechanics it encodes (AI code generation → file tree →
preview → build/error loop) originate from:

- Repository: https://github.com/stackblitz-labs/bolt.diy
- Upstream: stackblitz/bolt.new
- License: MIT
- Copyright (c) 2024 StackBlitz, Inc. and bolt.diy contributors

This RealSync adapter:

- Reimplements the protocol in framework-agnostic TypeScript (no Remix, no
  nanostores, no `@webcontainer/api` import).
- Does **not** vendor the Remix app, LLM provider registry, or Netlify/Vercel
  deploy paths.
- Wraps every action in RealSync governance (tenant, auth, entitlement,
  Prüfpfad, Evidence hash).
- Leaves WebContainer, COOP/COEP headers, wrangler, KV, and production
  deploys **disabled**. Those are production infrastructure.

The MIT license text of bolt.diy is included in the RealSync repository at
`docs/builder/BOLT_DIY_LICENSE.txt` when this module is merged.
