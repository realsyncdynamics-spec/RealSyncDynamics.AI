# Branch-Bestand `origin` — gemessen am 2026-09-05

**Zweck**: Grundlage für das Aufräumen der Remote-Branches. Diese Datei ist eine
**Messung mit Datum und Methode**, kein Vorschlag aus der Erinnerung — nach der
Lehre aus `CLAUDE.md` §5: messen, nicht herleiten.

## Methode

Nachvollziehbar, ohne GitHub-UI:

```bash
git fetch --unshallow --no-tags origin              # flacher Klon kann keine Abstammung prüfen
git fetch origin '+refs/heads/*:refs/remotes/origin/*'
git fetch origin '+refs/pull/*/head:refs/remotes/pr/*'   # 1175 PR-Köpfe
git branch -r --merged origin/main                  # Klasse A
git log origin/main --pretty=%s | grep -oE '\(#[0-9]+\)'  # 661 PR-Nummern in der main-History
```

Der Abgleich Branch-Tip ↔ PR-Kopf ordnet jedem Branch seinen PR zu; die offenen
PRs (23, Stand 2026-09-05) kommen aus der GitHub-API.

**Warum `--unshallow` nötig war**: Der Sitzungs-Klon ist flach. In einem flachen
Klon meldet `git branch --merged` zwangsläufig zu wenig — die Abstammung ist
schlicht nicht da. Wer ohne diesen Schritt misst, hält gemergte Branches für
ungemergt.

## Ergebnis — 283 Branches außer `main`

| Klasse | Anzahl | Bedeutung | Löschen? |
| --- | --- | --- | --- |
| **A** | 28 | Tip ist **Vorfahr von `main`** — Inhalt vollständig in `main` | risikofrei |
| **B** | 198 | PR vorhanden, **geschlossen ohne Merge** | rückholbar über `refs/pull/N/head` |
| **C** | 34 | **kein PR** — nur der Branch trägt die Commits | Entscheidung nötig |
| **D** | 23 | **offener PR** | behalten |
| **E** | 0 | dieser Arbeitsbranch | behalten |

**Kein Branch ist squash-gemergt und übersehen.** Der geprüfte Fall: Bei einem
Squash-Merge ist der Tip kein Vorfahr von `main`, der Branch sähe also
fälschlich „ungemergt" aus. Der Abgleich Tip ↔ PR-Kopf ↔ PR-Nummer in der
`main`-History fand **null** solcher Fälle — GitHub löscht diese Branches beim
Merge bereits selbst. Belegt an den drei Branches aus der Sichtung
(PR #1186, #1069, #649): alle drei existieren auf `origin` nicht mehr.

## Ausführung — hier blockiert, Werkzeug liegt bereit

Die Löschung der 226 Branches (Klasse A + B) ist **nicht erfolgt**. Sie wurde
versucht und von GitHub mit `HTTP 403` abgewiesen:

```
error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403
```

Das ist keine Netz- und keine Proxy-Störung — der Egress-Proxy verzeichnet
keinen Fehlschlag, und der Push **dieses** Branches lief im selben Lauf durch.
Das Token dieser Sitzung darf also schreiben, aber keine Refs löschen. Nicht
umgangen, nach der Regel „nicht drumherum arbeiten, sondern melden".

Der Zustand auf `origin` ist unverändert: nichts gelöscht, kein Teilstand.

**Auszuführen von einer Umgebung mit Löschrecht**:

```bash
./scripts/cleanup-merged-branches.sh            # Trockenlauf, zeigt die Liste
./scripts/cleanup-merged-branches.sh --apply    # löscht Klasse A + B
```

Das Skript trägt **keine feste Liste** — es misst bei jedem Lauf neu, sonst wäre
es ab dem nächsten Merge falsch. Klasse C (ohne PR) bleibt außen vor, bis sie
mit `--with-orphans` ausdrücklich dazugenommen wird.

## Klasse A — in `main` enthalten (28)

Auffällig: acht Varianten desselben Versuchs (`feat/governance-ai-product*`,
alle PR #1030) und ein `tmp-foo`. Das ist kein Datenverlust-Risiko, sondern
Ablagerung aus einer einzigen Sitzung.

| Branch | PR | letzter Commit |
| --- | --- | --- |
| `copilot/add-repository-secrets` | — | 2026-05-01 |
| `copilot/add-repository-secrets-again` | — | 2026-05-01 |
| `copilot/add-repository-secrets-another-one` | — | 2026-05-01 |
| `fix/open-graph-preview` | — | 2026-05-10 |
| `claude/merge-branches-4eKdL` | — | 2026-05-15 |
| `copilot/superbase-client-id` | — | 2026-05-27 |
| `copilot/projekt-link-optimierung` | — | 2026-05-28 |
| `claude/status-requirements-z7fyo4` | — | 2026-07-03 |
| `claude/autonomous-agents-phase6` | — | 2026-07-05 |
| `claude/frontend-dashboard-flow-nx7apl` | — | 2026-07-12 |
| `claude/road-map-aktuell-2qupbc` | — | 2026-07-13 |
| `claude/customer-discount-logic-q6kkyo` | #878 | 2026-07-23 |
| `claude/new-session-gxisaw` | — | 2026-07-23 |
| `claude/performance-monitoring-improvements-next` | #884 | 2026-07-26 |
| `design/premium-governance-hero` | — | 2026-08-13 |
| `feat/governance-ai-product` | #1030 | 2026-08-13 |
| `feat/governance-ai-product-bridge` | #1030 | 2026-08-13 |
| `feat/governance-ai-product-bridge2` | #1030 | 2026-08-13 |
| `feat/governance-ai-product-fixed` | #1030 | 2026-08-13 |
| `feat/governance-ai-product-fixed2` | #1030 | 2026-08-13 |
| `feat/governance-ai-product-optimizer` | #1030 | 2026-08-13 |
| `feat/governance-ai-product-optimizer2` | #1030 | 2026-08-13 |
| `feat/governance-ai-product-recovered` | #1030 | 2026-08-13 |
| `feat/wow-first-website-builder` | — | 2026-08-13 |
| `tmp-foo` | #1030 | 2026-08-13 |
| `refactor/commercial-ssot-phase-1-3` | — | 2026-08-25 |
| `copilot/fix-256874684-1213127985-4079b9d4-e29b-4099-94ad-6f0d70ff3135` | #1147 | 2026-08-29 |
| `copilot/fix-github-actions-job` | — | 2026-09-03 |

## Klasse C — ohne PR (34)

Diese verdienen den zweiten Blick: Es gibt keinen `refs/pull/N/head`, der die
Commits nach einer Löschung noch hielte.

| Branch | PR | letzter Commit |
| --- | --- | --- |
| `copilot/update-checksuite-integration` | — | 2026-05-09 |
| `claude/microsoft-azure-oauth` | — | 2026-05-10 |
| `feat/pitch-deck-page` | — | 2026-05-10 |
| `fix/278-checkout-route-missing` | — | 2026-05-16 |
| `copilot/fix-demo-to-live-report-flow` | — | 2026-05-18 |
| `claude/auth-oauth-dead-button-fix` | — | 2026-05-30 |
| `claude/governance-edge-auth-gate` | — | 2026-05-30 |
| `claude/quirky-brown-89NfC` | — | 2026-05-30 |
| `gh-pages` | — | 2026-06-05 |
| `feature/bolt-photorealistic-landing` | — | 2026-06-24 |
| `claude/governance-browser-os-shell` | — | 2026-06-28 |
| `claude/gallant-gauss-x6z1lf` | — | 2026-07-05 |
| `claude/checkout-scale-validation-rrwj7r` | — | 2026-07-11 |
| `claude/seo-marketing-saas-dashboard-knwhpu` | — | 2026-07-11 |
| `claude/sharp-cori-8s1iav` | — | 2026-07-12 |
| `claude/hostinger-sovereign-architecture-xhyqcy` | — | 2026-07-14 |
| `claude/realsync-govbrowser-feedback-mckjn2` | — | 2026-07-14 |
| `claude/realsync-roadmap-strategy-fqe70b` | — | 2026-07-14 |
| `claude/add-product-entry-points-uyowk4` | — | 2026-07-16 |
| `claude/session-v97bu0` | — | 2026-07-21 |
| `claude/stripe-admin-functions-security-f47vka` | — | 2026-08-02 |
| `claude/perplexity-mcp-6jm63t` | — | 2026-08-03 |
| `phase-2/branch-protection` | — | 2026-08-03 |
| `vibe/templates-optimized-c2c339` | — | 2026-08-07 |
| `fix/governance-runtime-896` | — | 2026-08-09 |
| `claude/delete-old-prs-k461h4` | — | 2026-08-10 |
| `chore/selective-p0-auth-deploy` | — | 2026-08-11 |
| `realsyncdynamics-spec-restore-production-infrastructure` | — | 2026-08-12 |
| `feat/governance-ai-product-recovery` | — | 2026-08-13 |
| `feat/main-landing-governance-os` | — | 2026-08-13 |
| `tmp/recover-optimizer-bridge` | — | 2026-08-13 |
| `claude/siteos-skill-workflow-vocabulary` | — | 2026-09-02 |
| `claude/vigilant-wright-h5o8y5` | — | 2026-09-04 |
| `claude/determined-goodall-xbk4rc` | — | 2026-09-05 |

## Klasse D — offener PR, bleibt (23)

| Branch | PR | letzter Commit |
| --- | --- | --- |
| `feat/siteos-stripe-dashboard-funnel` | #1035 | 2026-08-12 |
| `claude/eu-ai-act-compliance-wnsqg5` | #1094 | 2026-08-19 |
| `feat/photoreal-builder-live` | #1114 | 2026-08-21 |
| `feat/resend-vault-mailer` | #1149 | 2026-08-28 |
| `feat/self-service-agent-onboarding` | #1152 | 2026-08-29 |
| `claude/supabase-billing-edge-85ylbw` | #1098 | 2026-08-30 |
| `feat/tenant-crm` | #1133 | 2026-08-30 |
| `claude/ai-builder-governance-monorepo-73z293` | #1121 | 2026-09-02 |
| `claude/github-repo-link-yhupho` | #1128 | 2026-09-04 |
| `claude/governance-decisions-pre-migration-gyqm4p` | #1202 | 2026-09-04 |
| `claude/governance-pricing-launch-et1wij` | #1211 | 2026-09-04 |
| `claude/new-session-y4r1vx` | #1164 | 2026-09-04 |
| `claude/orbit-dove-quiet-timber-gruapa` | #1201 | 2026-09-04 |
| `fix/stale-migration-reference` | #1206 | 2026-09-04 |
| `claude/artifact-code-session-dovnbv` | #1207 | 2026-09-05 |
| `claude/governance-os-plan-y5rplu` | #1135 | 2026-09-05 |
| `claude/pricing-feature-gating-r5l0xn` | #1214 | 2026-09-05 |
| `claude/realsync-frontend-app-builder-akkajm` | #1218 | 2026-09-05 |
| `claude/realsyncdynamics-onboarding-q4wzcn` | #1209 | 2026-09-05 |
| `claude/realsyncdynamics-weekly-report-yd2x9c` | #1181 | 2026-09-05 |
| `claude/realsyncdynamicsai-audit-xjwfd3` | #1217 | 2026-09-05 |
| `claude/task-checklist-oiiis7` | #1213 | 2026-09-05 |
| `feature/github-integration-bidirectional` | #1219 | 2026-09-05 |

## Klasse B — PR geschlossen ohne Merge (198)

Vollständig, weil die Zahl sonst nicht prüfbar wäre.

| Branch | PR | letzter Commit |
| --- | --- | --- |
| `claude/marketing-bronze-silver-gold` | #121 | 2026-05-09 |
| `content/conversion-sections` | #165 | 2026-05-13 |
| `feat/roadmap-pricing-update` | #166 | 2026-05-13 |
| `feat/smb-messaging` | #174 | 2026-05-13 |
| `fix/roadmap-pricing-rebased` | #172 | 2026-05-13 |
| `claude/deep-audit-platform` | #235 | 2026-05-14 |
| `fix/deploy-trigger-on-config-toml` | #221 | 2026-05-14 |
| `claude/command-center-group-a` | #258 | 2026-05-15 |
| `claude/command-center-group-b` | #259 | 2026-05-15 |
| `claude/secure-business-dashboard-auth` | #268 | 2026-05-16 |
| `claude/fix-main-syntax-errors` | #341 | 2026-05-18 |
| `claude/hotfix-jsx-span-tags` | #339 | 2026-05-18 |
| `claude/hotfix-report-preview-stray-tags` | #338 | 2026-05-18 |
| `claude/infrastructure-restructure-2GAHl` | #335 | 2026-05-18 |
| `claude/phase-a-governance-event-ingest` | #332 | 2026-05-18 |
| `claude/review-project-status-umBWS` | #331 | 2026-05-18 |
| `claude/seo-derive-from-pricing` | #336 | 2026-05-18 |
| `claude/zen-fermi-QJCxm` | #334 | 2026-05-18 |
| `claude/clarify-technical-limits-hDVQo` | #362 | 2026-05-19 |
| `claude/fix-runtime-feed-jsx` | #360 | 2026-05-19 |
| `claude/runtime-ui-leitstand-migration` | #363 | 2026-05-19 |
| `claude/runtime-vvt-slice` | #359 | 2026-05-19 |
| `claude/hostinger-pattern-phase-1` | #386 | 2026-05-22 |
| `claude/runtime-event-writer-tier-discipline-p0-3` | #395 | 2026-05-22 |
| `fix/sub-processors-add-missing` | #417 | 2026-05-24 |
| `fix/governance-agent-shorten-prompts` | #421 | 2026-05-25 |
| `claude/findings-fingerprint` | #436 | 2026-05-26 |
| `claude/focused-volta-dZm5C` | #447 | 2026-05-26 |
| `claude/lint-duplicate-timestamp-allowlist` | #454 | 2026-05-26 |
| `claude/openclaw-hostinger-setup-2ontG` | #402 | 2026-05-26 |
| `claude/ops-stabilization-audit` | #453 | 2026-05-26 |
| `claude/realsync-knowledge-foundation-qc2X9` | #433 | 2026-05-26 |
| `claude/realsync-project-status-MWnga` | #435 | 2026-05-26 |
| `claude/dns-inventory-pre-cloudflare` | #479 | 2026-05-29 |
| `claude/enhanced-conversions-gclid` | #333 | 2026-05-29 |
| `claude/gemma-4-system-check-V5MJI` | #485 | 2026-05-29 |
| `claude/go-setup-a7an5` | #416 | 2026-05-29 |
| `claude/landing-enterprise-positioning` | #469 | 2026-05-29 |
| `claude/landing-page-stabilization-2` | #478 | 2026-05-29 |
| `claude/operational-event-backbone-FQwzn` | #480 | 2026-05-29 |
| `claude/p0-avv-subprocessor-list` | #470 | 2026-05-29 |
| `claude/p0-security-headers` | #472 | 2026-05-29 |
| `claude/p1-cors-origin-whitelist` | #474 | 2026-05-29 |
| `claude/p1-favicon-hidden-block` | #473 | 2026-05-29 |
| `claude/platform-positioning-strategy-XmOiA` | #475 | 2026-05-29 |
| `claude/positioning-sync-app-ui` | #483 | 2026-05-29 |
| `claude/positioning-sync-docs-landings` | #477 | 2026-05-29 |
| `claude/product-scaling-exit-WL5QY` | #464 | 2026-05-29 |
| `claude/realsync-agency-pilot-bGYBA` | #412 | 2026-05-29 |
| `claude/realsync-beta-launch-mij57` | #455 | 2026-05-29 |
| `claude/status-check-cleanup-msHB7` | #481 | 2026-05-29 |
| `claude/dns-static-subdomains-cdn-preview-schemas` | #487 | 2026-05-30 |
| `claude/governance-os-product-architecture` | #497 | 2026-05-30 |
| `claude/p0b-admin-console-plan` | #494 | 2026-05-30 |
| `claude/p0c-aal2-enforce-plan` | #496 | 2026-05-30 |
| `claude/project-goals-requirements-ii0xd` | #488 | 2026-05-30 |
| `claude/session-analysis-deployment-O1sDQ` | #489 | 2026-05-30 |
| `claude/gallant-bell-DP1qV` | #511 | 2026-05-31 |
| `claude/realsync-governance-restructure-WA6vR` | #510 | 2026-05-31 |
| `claude/assistant-button-routing-c2qHe` | #524 | 2026-06-04 |
| `claude/analysis-38MSD` | #523 | 2026-06-05 |
| `claude/fix-ci-policy-syntax-and-pricing-test` | #534 | 2026-06-08 |
| `claude/realsync-gtm-strategy-wj4zl0` | #540, #626 | 2026-06-09 |
| `claude/phase3-e2e-governance-os` | #536 | 2026-06-10 |
| `claude/production-readiness-testing-k528fu` | #542 | 2026-06-10 |
| `claude/ecstatic-mendel-ViESh` | #550 | 2026-06-11 |
| `claude/review-existing-test-tools-fx63r0` | #546 | 2026-06-11 |
| `claude/qa-checkout-probe` | #560 | 2026-06-13 |
| `claude/automation-skills-phase2-g9dyby` | #577 | 2026-06-15 |
| `claude/governance-os-hardening-001` | #576 | 2026-06-15 |
| `claude/governance-os-visibility` | #522 | 2026-06-16 |
| `claude/qa-governance-suite` | #554 | 2026-06-16 |
| `claude/realsync-visibility-fixes-xop65v` | #594 | 2026-06-16 |
| `claude/analysis-rederive-38MSD` | #632 | 2026-06-17 |
| `claude/hostinger-cloudflare-dns-setup-dqwkqa` | #630 | 2026-06-17 |
| `claude/landing-e2e-rebrand-sync` | #633 | 2026-06-17 |
| `claude/public-entry-product-frontend-GeAtA` | #629 | 2026-06-17 |
| `claude/realsync-dynamics-governance-os-n0vusk` | #622 | 2026-06-17 |
| `claude/government-seo-fixes-ste49s` | #640 | 2026-06-19 |
| `claude/wonderful-wozniak-yr8ick` | #638 | 2026-06-20 |
| `claude/consolidate-20260624-migrations` | #661 | 2026-06-21 |
| `claude/realsync-audit-valuation-15erb1` | #650 | 2026-06-21 |
| `claude/relaxed-pasteur-x0w90t` | #646 | 2026-06-21 |
| `claude/sharp-cori-rwzg2c` | #657 | 2026-06-21 |
| `claude/vigilant-volta-ffez6b` | #656 | 2026-06-21 |
| `claude/pensive-johnson-w4a7ws` | #624 | 2026-06-22 |
| `claude/beautiful-lovelace-wsh1qr` | #669 | 2026-06-23 |
| `claude/gallant-brown-o7ci7m` | #668 | 2026-06-23 |
| `claude/magical-wright-5aat5k` | #685 | 2026-06-23 |
| `claude/r4-cf-pages-deeplink` | #681 | 2026-06-23 |
| `claude/review-status-check-q3vlrw` | #673 | 2026-06-23 |
| `claude/amazing-pasteur-8nhchc` | #691 | 2026-06-24 |
| `claude/mainlanding-earth-hero` | #683 | 2026-06-24 |
| `claude/realsync-dynamics-audit-j5pkcl` | #698 | 2026-06-24 |
| `claude/realsyncdynamicsai-dns-issue-i7t52t` | #688 | 2026-06-24 |
| `claude/task-list-wf9di1` | #695 | 2026-06-24 |
| `claude/fix-inu9h3` | #699 | 2026-06-25 |
| `claude/nifty-gauss-jhpye0` | #709 | 2026-06-26 |
| `claude/frontend-pricing-screenshots-ocew4x` | #730, #761 | 2026-06-30 |
| `claude/restore-previous-price-packages-w8sewn` | #729 | 2026-06-30 |
| `claude/realsyncdynamicsai-test-results-7aptw2` | #793 | 2026-07-07 |
| `claude/realsync-saas-architecture-1rc9x7` | #821 | 2026-07-16 |
| `claude/website-operations-layer-qgcho4` | #830 | 2026-07-18 |
| `claude/audit-migration-strategy-x3ia2s` | #854 | 2026-07-20 |
| `claude/inventory-audit-roadmap-tww3pb` | #853 | 2026-07-20 |
| `claude/checkout-bug-ic836s` | #864 | 2026-07-21 |
| `claude/realsync-ai-governance-mvp-m1ptif` | #820 | 2026-07-21 |
| `claude/vercel-removal-claudeflare-migration-sz5g1w` | #865 | 2026-07-21 |
| `claude/changes-required-kuvugf` | #879 | 2026-07-23 |
| `claude/checkout-error-diagnosis-cleg8w` | #870 | 2026-07-23 |
| `claude/landing-page-design-improvements-c91trt` | #876 | 2026-07-23 |
| `claude/realsync-ai-governance-positioning-9n3gt3` | #866 | 2026-07-23 |
| `claude/routing-ubersicht-bugs-67pu39` | #852 | 2026-07-23 |
| `feat/pricing-add-ons` | #877 | 2026-07-23 |
| `claude/dashboard-button-audit-0mm92v` | #880 | 2026-07-25 |
| `claude/deployment-i2g0l8` | #882 | 2026-07-26 |
| `claude/evidence-vault-archive-qw7k2x` | #890 | 2026-07-26 |
| `claude/git-commit-email-config-ypoiwq` | #883 | 2026-07-26 |
| `claude/mcp-server-authentication-d838wm` | #889 | 2026-07-26 |
| `claude/new-session-afik1t` | #856 | 2026-07-26 |
| `claude/platform-intelligence-agent-11tcgd` | #859 | 2026-07-26 |
| `feat/evidence-archive` | #874 | 2026-07-26 |
| `claude/agent-runtime-platform-9rl44j` | #855 | 2026-07-27 |
| `claude/governance-runtime-completion-h9k3m2` | #896 | 2026-07-27 |
| `claude/realsync-dashboard-ui-expansion` | #881, #885 | 2026-07-27 |
| `claude/realsync-feature-comparison-dashboard-uuuygp` | #881, #885 | 2026-07-27 |
| `claude/realsync-org-structure-1fntil` | #899 | 2026-07-27 |
| `claude/stripe-paket-live-deploy-cq1gpu` | #891 | 2026-07-27 |
| `claude/enterprise-self-service-checkout` | #902 | 2026-07-28 |
| `vibe/communication-templates-improvements-39ebed17` | #906 | 2026-07-29 |
| `claude/logistics-os-architecture-9jjce7` | #930 | 2026-08-01 |
| `claude/realsync-dashboard-mobile-polish` | #895 | 2026-08-01 |
| `claude/realsync-siteos-impl-jleepu` | #904 | 2026-08-01 |
| `claude/capture-prod-orphan-migrations` | #949 | 2026-08-02 |
| `claude/preise-wjbt73` | #945 | 2026-08-02 |
| `claude/test-fix-verification-908-e2c6u9` | #939 | 2026-08-02 |
| `claude/agent-browser-gscrjv` | #970 | 2026-08-03 |
| `claude/agents-6r7r4u` | #972 | 2026-08-03 |
| `claude/fix-jsr-supabase-pin` | #960 | 2026-08-03 |
| `claude/realsyncdynamics-ai-review-ruoepx` | #966 | 2026-08-03 |
| `claude/social-publisher-x-alert-793530` | #965 | 2026-08-03 |
| `claude/typescript-strict-docs-fix-752978` | #955 | 2026-08-03 |
| `claude/social-orchestrator-persistence-wiring` | #981 | 2026-08-04 |
| `claude/unified-pricing-presentation-daphbk` | #982 | 2026-08-04 |
| `vibe/template-improvements-f3cfc9` | #985 | 2026-08-06 |
| `claude/pr-matrix-governance-runtime-pvclb6` | #991 | 2026-08-08 |
| `claude/runtime-core-smoke-check` | #987 | 2026-08-08 |
| `claude/agent-operations-layer-p4-susi` | #994 | 2026-08-09 |
| `claude/agent-operations-layer-p5-screenshot` | #996 | 2026-08-09 |
| `claude/governance-launch-one-time-3bown1` | #995 | 2026-08-09 |
| `claude/realsync-hero-refinement-jaxdb6` | #998 | 2026-08-09 |
| `claude/dsgvo-nis2-explanation-n7p0s4` | #1002 | 2026-08-10 |
| `claude/seo-visibility-deployment-3g8kum` | #947 | 2026-08-10 |
| `chore/p0-deploy-manifest-migrations` | #1012 | 2026-08-11 |
| `claude/realsync-browser-agent-e50pq9` | #1016 | 2026-08-11 |
| `claude/serene-ritchie-9ymdry` | #1010 | 2026-08-11 |
| `fix/p0-entitlement-flow` | #1013 | 2026-08-11 |
| `feat/ai-seo-command-workbench` | #1028 | 2026-08-12 |
| `feat/post-stripe-project-dashboard` | #1029 | 2026-08-12 |
| `feat/siteos-go-live-funnel` | #1036 | 2026-08-12 |
| `feat/website-transformation-pricing` | #1031 | 2026-08-12 |
| `feat/xai-style-command-ux` | #1027 | 2026-08-12 |
| `realsyncdynamics-spec-complete-one-time-transformation-flow` | #1037 | 2026-08-12 |
| `ci/website-transformation-final` | #1051 | 2026-08-13 |
| `cloudflare-mcp-wrangler-hardening` | #1046 | 2026-08-13 |
| `feat/ai-website-transformation-engine` | #1049 | 2026-08-13 |
| `feat/enterprise-governance-hero-20260813` | #1050 | 2026-08-13 |
| `feat/governance-ai-recovery` | #1045 | 2026-08-13 |
| `feat/first-customer-revenue-path` | #1053 | 2026-08-14 |
| `feat/gemini-ai-studio-builder` | #1052 | 2026-08-14 |
| `claude/ai-studio-trunk-consolidation` | #1059, #1060 | 2026-08-15 |
| `claude/audit-scanner-ddg-migration` | #979 | 2026-08-15 |
| `claude/builder-token-budget` | #1063 | 2026-08-15 |
| `claude/legal-ddg-tdddg` | #1062 | 2026-08-15 |
| `claude/port-group-b` | #1064 | 2026-08-15 |
| `claude/trunk-consolidation` | #1059, #1060 | 2026-08-15 |
| `feat/pricing-v2-modular-saas` | #1055 | 2026-08-15 |
| `claude/ai-studio-master-prompt` | #1067 | 2026-08-16 |
| `claude/new-session-va9jt9` | #1084 | 2026-08-16 |
| `claude/revert-landing-frontend-f937j3` | #1088 | 2026-08-16 |
| `claude/social-orchestrator-persistence-redo` | #1080 | 2026-08-16 |
| `claude/social-publisher-x-alert-redo` | #1079 | 2026-08-16 |
| `feat/governance-ai-dynamic-globe` | #1070 | 2026-08-16 |
| `fix/gemini-provider-routing` | #1074 | 2026-08-16 |
| `claude/cloudflare-deployment-fix-d4jzd2` | #1089 | 2026-08-17 |
| `claude/fix-hero-ssot-truthlayer` | #1090 | 2026-08-17 |
| `claude/pr-1075-draft-status-dv02b8` | #1087 | 2026-08-17 |
| `feat/real-sync-ai-studio-transformation-engine` | #1054 | 2026-08-19 |
| `fix/bot-waitlist-truth-layer` | #1093 | 2026-08-19 |
| `claude/dsgvo-compliance-tools-2026-om3n9f` | #1099 | 2026-08-21 |
| `copilot/fix-256874684-1213127985-d9178dcb-82f6-4f83-be28-11d4eda5143c` | #1112 | 2026-08-21 |
| `fix/current-funnel-pricing-frontend` | #1140 | 2026-08-25 |
| `copilot/fix-256874684-1213127985-dffd122f-b843-410a-800a-1c4296acaa7a` | #1150 | 2026-08-28 |
| `feat/platform-os-onboarding` | #1145 | 2026-08-28 |
| `claude/siteos-publish-gate` | #1154 | 2026-08-29 |
| `claude/realsync-repo-audit-mwr2vs` | #1155 | 2026-08-30 |
| `claude/readonly-audit-middleware-tenant-debrww` | #1182 | 2026-09-01 |
| `claude/production-offer-safety-v2q93t` | #1198 | 2026-09-02 |
