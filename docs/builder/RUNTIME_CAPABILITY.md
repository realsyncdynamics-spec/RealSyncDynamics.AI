# Web App Builder — Runtime capability

**srcDoc is a sandboxed document preview, not a Bolt/Lovable full-stack runtime.**

WebContainer remains `disabled` (COOP/COEP = production infrastructure).

| Capability | Support | Notes |
|---|---|---|
| HTML + CSS | yes | `index.html` + inlined local stylesheets |
| Local classic JS | yes | Relative `<script src>` inlined under interactive isolation |
| Multi-file tree | yes | FileStore + preview inlining |
| ESM `import` / bundler | no | No bundler, CSP `default-src 'none'` |
| React / JSX | no | Source may be stored; it is not executed |
| History router | no | srcDoc has no navigable origin URL |
| CDN / external assets | no | CSP blocks remote scripts, fonts, APIs |
| Node / npm / WebContainer | no | Shell/start/build stay HOLD |

Code: `src/features/app-builder/bolt/runtime-capability.ts`. Tests: `test/app-builder/runtime-capability.test.ts`.

Do not market this surface as a full-stack Web-App-Builder until a licensed, reviewed runtime exists.
