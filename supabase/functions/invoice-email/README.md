# Invoice Email — Stripe Invoice Delivery

Sends invoice confirmation emails when `invoice.paid` Stripe webhook fires.

## Endpoint

```
POST /functions/v1/invoice-email
Authorization: Bearer $SERVICE_ROLE_KEY
Content-Type: application/json
```

## Request

```json
{
  "stripe_invoice_id": "in_123...",
  "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

## Response

Success (200):
```json
{
  "ok": true,
  "sent_id": "123abc...",
  "to": "billing@example.com",
  "invoice_id": "in_123..."
}
```

Idempotent (already sent):
```json
{
  "ok": true,
  "skipped": "already_sent",
  "sent_at": "2026-07-05T12:00:00Z"
}
```

## Workflow

1. Triggered by `stripe-webhook` handler on `invoice.paid` event
2. Fetches invoice & tenant details from `invoices` + `tenants` tables
3. Renders branded HTML invoice confirmation email
4. Sends via Resend
5. Sets `invoices.invoice_email_sent_at` to prevent duplicates
6. Gracefully skips if `RESEND_API_KEY` not configured

## Configuration

### Environment Variables
- `RESEND_API_KEY` — Resend API key (or set via vault `resend_api_key`)
- `INVOICE_EMAIL_FROM` — Sender email (default: `billing@realsyncdynamicsai.de`)

### Database Requirements
- `invoices.invoice_email_sent_at` — timestamp field (nullable)
- `tenants.billing_email` — optional billing contact email

## Idempotency

Email sending is idempotent:
- On first call: sends email, updates `invoice_email_sent_at`
- On retry: returns `skipped: "already_sent"` without re-sending
- Failures roll back `invoice_email_sent_at` so Stripe will retry

## Error Handling

| Code | Error | Meaning |
|------|-------|---------|
| 404  | NOT_FOUND | Invoice or tenant missing |
| 400  | NO_EMAIL | No billing email to send to |
| 502  | RESEND_FAILED | Resend API error |

## Testing

```bash
curl -X POST http://localhost:54321/functions/v1/invoice-email \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stripe_invoice_id": "in_1234567890",
    "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }'
```
