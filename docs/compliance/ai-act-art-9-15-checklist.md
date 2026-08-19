# EU AI Act — Checklist Art. 9–15 (High-Risk) + Art. 50 (Transparency)

**Status:** Normative reference for RealSync Governance OS  
**Regulation:** Regulation (EU) 2024/1689 (AI Act), as amended by Regulation (EU) 2026/1744 (Digital Omnibus on AI)  
**Verified:** 2026-08-19  
**Scope:** High-risk AI systems (Chapter III) and separate transparency obligations (Art. 50)

> **Disclaimer:** Operational checklist for product and compliance engineering. Not legal advice. Re-verify application dates and article text against the consolidated Official Journal before formal audits or market claims.

---

## Application dates (verified)

| Obligation set | Applies from | Legal basis |
|----------------|--------------|-------------|
| Prohibited practices (Art. 5) | 2025-02-02 | AI Act |
| Transparency (Art. 50) | **2026-08-02** | AI Act; **not** deferred by Omnibus |
| Art. 50(2) machine-readable marking for systems already on market before 2026-08-02 | **2026-12-02** | Omnibus transitional relief |
| High-risk requirements Chapter III (incl. Art. 9–15) for **Annex III** systems | **2027-12-02** | Omnibus deferral |
| High-risk requirements Chapter III for **Annex I** product-embedded systems | **2028-08-02** | Omnibus deferral |

Sources to re-check: EUR-Lex consolidated AI Act; Regulation (EU) 2026/1744; Commission pages on AI Act / Omnibus.

---

## Design principles (RealSync)

1. **Chain, not checkbox**  
   `Requirement → Assessment → Evidence → Finding → Remediation → Review`

2. **Art. 50 is separate from Art. 13**  
   Art. 13 = transparency / instructions for **deployers of high-risk systems**.  
   Art. 50 = transparency for **certain AI systems** (interaction, synthetic content, etc.), risk-class independent.  
   Link assessments (`related_requirement_ids`) — do not merge legal bases.

3. **No legal compliance claims as facts**  
   Product and marketing may only state technical/documentary indicators backed by evidence.

4. **Machine-readable catalog**  
   Requirement IDs in this document match `docs/compliance/ai-act-requirement-catalog.json`.  
   Assessment records follow `docs/compliance/ai-act-compliance-assessment.schema.json`.

---

## Status values (assessment)

| Status | Meaning |
|--------|---------|
| `open` | Not started |
| `partial` | Started; material gaps remain |
| `satisfied` | Requirement met with linked evidence |
| `not_applicable` | Documented reason required (`applicability_reason`) |
| `blocked` | Cannot proceed (dependency, missing access, legal hold) |

---

## Art. 9 — Risk management system

| ID | Requirement | Provider | Deployer |
|----|-------------|----------|----------|
| 9.1 | Risk management system established, implemented, documented, and maintained for the AI system lifecycle | □ | □ |
| 9.2 | Known and reasonably foreseeable risks to health, safety, and fundamental rights identified and analysed | □ | □ |
| 9.3 | Risks assessed for intended purpose **and** reasonably foreseeable misuse | □ | □ |
| 9.4 | Risk mitigation measures defined and prioritised | □ | □ |
| 9.5 | Residual risks documented and justified as acceptable | □ | □ |
| 9.6 | System updated when the AI system, risks, or incidents change | □ | □ |
| 9.7 | Testing of risk-mitigation measures performed as appropriate | □ | □ |
| 9.8 | Post-market monitoring inputs feed the risk management system | □ | □ |

**Evidence examples:** risk register, residual-risk sign-off, test reports, monitoring SOP, incident log.

---

## Art. 10 — Data and data governance

| ID | Requirement | Provider | Deployer |
|----|-------------|----------|----------|
| 10.1 | Training, validation, and testing data (where used) described | □ | □ |
| 10.2 | Data relevant, sufficiently representative, and as free of errors/complete as possible for the purpose | □ | □ |
| 10.3 | Data governance practices documented (origin, collection, preparation, labelling) | □ | □ |
| 10.4 | Bias/examination and mitigation measures applied where relevant to the use case | □ | □ |
| 10.5 | Special-category personal data only under applicable legal conditions | □ | □ |
| 10.6 | Datasets and governance measures traceable for conformity assessment | □ | □ |

**Evidence examples:** data cards, dataset inventory, bias evaluation report, DPIA link, sub-processor map.

---

## Art. 11 — Technical documentation

| ID | Requirement | Provider | Deployer |
|----|-------------|----------|----------|
| 11.1 | Technical documentation available **before** placing on the market / putting into service | □ | □ |
| 11.2 | General description (purpose, provider, version, intended users) | □ | □ |
| 11.3 | Detailed description (architecture, models, interfaces, design choices) | □ | □ |
| 11.4 | Development process and data used described | □ | □ |
| 11.5 | Risk management documented (link to Art. 9) | □ | □ |
| 11.6 | Monitoring, functioning, and control mechanisms described | □ | □ |
| 11.7 | Changes to the system and their effects traceable | □ | □ |
| 11.8 | Documentation current and available to authorities / assessment bodies | □ | □ |

**Evidence examples:** Annex-IV-style tech file, version history, architecture diagram, change log.

---

## Art. 12 — Record-keeping

| ID | Requirement | Provider | Deployer |
|----|-------------|----------|----------|
| 12.1 | Automatic logging of relevant events during operation | □ | □ |
| 12.2 | Logs support traceability of results/outputs | □ | □ |
| 12.3 | Logs support operational monitoring and risk detection | □ | □ |
| 12.4 | Retention period defined and enforced | □ | □ |
| 12.5 | Integrity and access control of logs ensured | □ | □ |
| 12.6 | Deployers can use or receive relevant logs as appropriate | □ | □ |

**Evidence examples:** log schema, retention policy, custody/hash chain, access audit, export procedure.

---

## Art. 13 — Transparency and information to deployers

*High-risk only. Do **not** encode Art. 50 duties here.*

| ID | Requirement | Provider | Deployer |
|----|-------------|----------|----------|
| 13.1 | Instructions for use clear and accessible | □ | □ |
| 13.2 | Characteristics, capabilities, and limitations described | □ | □ |
| 13.3 | Intended purpose and prohibited / risky misuse described | □ | □ |
| 13.4 | Performance information (metrics, known error rates where relevant) | □ | □ |
| 13.5 | Human oversight guidance (link to Art. 14) | □ | □ |
| 13.6 | Guidance on interpreting outputs | □ | □ |
| 13.7 | Maintenance, updates, and material changes communicated | □ | □ |

**Related (not merged):** Art. 50 block — `related_requirement_ids: ["50.1", …]`.

---

## Art. 14 — Human oversight

| ID | Requirement | Provider | Deployer |
|----|-------------|----------|----------|
| 14.1 | System designed to enable effective human oversight | □ | □ |
| 14.2 | Oversight persons have competence and authority | □ | □ |
| 14.3 | Oversight can understand, challenge, and withhold reliance on outputs | □ | □ |
| 14.4 | Ability to interrupt, stop, or deactivate the system | □ | □ |
| 14.5 | Measures against automation bias | □ | □ |
| 14.6 | Oversight embedded in instructions and internal procedures | □ | □ |

**Evidence examples:** RACI, oversight SOP, kill-switch / gate design, training records.

---

## Art. 15 — Accuracy, robustness, cybersecurity

| ID | Requirement | Provider | Deployer |
|----|-------------|----------|----------|
| 15.1 | Appropriate level of accuracy defined and measured for the intended purpose | □ | □ |
| 15.2 | Robustness against errors, faults, and inconsistencies | □ | □ |
| 15.3 | Resilience to manipulation attempts where relevant | □ | □ |
| 15.4 | Cybersecurity measures proportionate to risk | □ | □ |
| 15.5 | Feedback loops / drift handled where applicable | □ | □ |
| 15.6 | Performance and security maintained over the lifecycle | □ | □ |

**Evidence examples:** eval reports, security tests, incident response, monitoring dashboards.

---

## Art. 50 — Transparency (separate block)

*Applies from 2026-08-02. Independent of high-risk classification. Link to Art. 13 where both apply; do not merge.*

| ID | Requirement | Role | Notes |
|----|-------------|------|-------|
| 50.1 | Natural persons informed they interact with an AI system (unless obvious) | Provider | Chatbots, agents, avatars |
| 50.2 | Synthetic audio/image/video/text marked machine-readable and detectable | Provider | Transitional relief to 2026-12-02 for systems on market before 2026-08-02 |
| 50.3 | Persons exposed to emotion recognition / biometric categorisation informed | Deployer | |
| 50.4 | Deepfakes and certain public-interest AI text disclosed | Deployer | Human review / editorial responsibility exceptions may apply |

**RealSync product touchpoints:** AI Studio UI disclosure, `ai-disclosure` block, `aiGenerated` flags, SiteOS publish gate.

---

## Assessment chain (normative)

```text
Requirement (catalog ID)
    → Assessment (status, owner, reviewer, dates)
        → Evidence (evidence_ids[])
        → Finding (optional gap)
            → Remediation (plan, due_at)
                → Review (next_review_at, sign-off)
```

Do **not** reduce this to a single checkbox without evidence and review metadata.

---

## Scorecard template

| Article | Open | Partial | Satisfied | N/A | Blocked |
|---------|------|---------|-----------|-----|---------|
| 9 | | | | | |
| 10 | | | | | |
| 11 | | | | | |
| 12 | | | | | |
| 13 | | | | | |
| 14 | | | | | |
| 15 | | | | | |
| 50 | | | | | |

**Asset / system:** _______________  
**Classification:** Annex III / Annex I / not high-risk / Art. 6(3) self-assessment  
**Assessed at:** _______________  
**Next review:** _______________

---

## Related files

- `docs/compliance/ai-act-requirement-catalog.json` — machine-readable requirement IDs
- `docs/compliance/ai-act-compliance-assessment.schema.json` — Governance OS assessment record schema
- `docs/GOVERNANCE_OS_INSPECTOR.md` — Inspector UI patterns
- `packages/siteos-core/src/types.ts` — `eu-ai-act` dimension, `ai-disclosure` block

---

*Last verified against public Omnibus / Commission timeline materials: 2026-08-19. Re-verify before external audit use.*
