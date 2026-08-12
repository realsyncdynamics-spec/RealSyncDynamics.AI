# Post-Stripe Website Transformation Flow

1. Customer enters a domain.
2. SiteOS discovery/audit produces the findings.
3. Customer previews the proposed rebuilt website.
4. Customer is shown the DSGVO/website transformation scope and the canonical one-time price from the pricing SSOT.
5. **Yes** starts the one-time Stripe checkout for the transformation entitlement.
6. **No** routes to the normal recurring Stripe plans.
7. Stripe webhook is authoritative for entitlement activation; the browser success page never grants access itself.
8. After entitlement activation the customer lands in the Website Transformation Dashboard.
9. Dashboard exposes the project pipeline: analysis → concept → build → SEO → DSGVO → bots → preview → approval → deployment.
10. Deployment remains gated by explicit customer approval.

The dashboard is a project workspace, not a replacement for the normal governance dashboard.
