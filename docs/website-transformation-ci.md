# Website Transformation Engine — CI Contract

The public website transformation flow is validated as:

1. Domain scan
2. DSGVO / governance findings
3. modernization potential
4. generated landing variants
5. preview and selection
6. existing backend remains unchanged
7. selected frontend proceeds to the SiteOS builder

The builder request may carry `enrichment` (`name`, `summary`, `services`, `locality`) and the public preview must remain self-service: no demo, sales-call, appointment, or consultation CTA language.

This document exists as a small, intentional CI checkpoint so the current `main` contracts are exercised by the repository pull-request gates.
