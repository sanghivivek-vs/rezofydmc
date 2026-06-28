# Integration contract — DMC ⇄ Tour Agency platform

This directory is the **source of truth** for the cross-platform contract
(Build guide §6). Both teams code against these JSON Schemas. Schemas are
versioned with the endpoints (`/v1/…`); changes within a version are additive only.

## Conventions

- **Shared IDs:** `agency_id`, `enquiry_external_id`, `quote_external_id` are
  stable across both platforms.
- **Auth:** service-to-service (OAuth client-credentials — to confirm, ADR 0005).
- **Idempotency:** every write/webhook carries `idempotency_key`; consumers dedupe.
- **Signing:** webhooks are HMAC-signed over the raw body; verify before
  processing.
- **Money:** integer `amount_minor` + ISO `currency` on the wire (ADR 0003).
- **Time:** ISO-8601 UTC timestamps; dates are `YYYY-MM-DD`.

## Directions

### Inbound — Tour Agency platform → DMC (to us)

| Event                | Schema                                   |
| -------------------- | ---------------------------------------- |
| `enquiry.created`    | [inbound/enquiry.created.schema.json]    |
| `enquiry.updated`    | same shape as `enquiry.created`          |
| `revision.requested` | [inbound/revision.requested.schema.json] |
| `quote.accepted`     | [inbound/quote.decision.schema.json]     |
| `quote.rejected`     | same shape as `quote.accepted`           |
| `message.posted`     | _planned_                                |

### Outbound — DMC → Tour Agency platform (from us)

| Event                    | Schema                                        |
| ------------------------ | --------------------------------------------- |
| `quote.sent`             | [outbound/quote.sent.schema.json]             |
| `quote.created/updated`  | subset of `quote.sent`                        |
| `itinerary.shared`       | _planned_                                     |
| `segment.status.updated` | [outbound/segment.status.updated.schema.json] |
| `document.shared`        | _planned_                                     |

## Envelope

Every webhook body shares a common envelope; the event-specific schema describes
`data`:

```json
{
  "event": "enquiry.created",
  "version": "v1",
  "idempotency_key": "uuid",
  "occurred_at": "2026-06-28T10:00:00Z",
  "data": { "...": "event-specific payload" }
}
```

[inbound/enquiry.created.schema.json]: ./inbound/enquiry.created.schema.json
[inbound/revision.requested.schema.json]: ./inbound/revision.requested.schema.json
[inbound/quote.decision.schema.json]: ./inbound/quote.decision.schema.json
[outbound/quote.sent.schema.json]: ./outbound/quote.sent.schema.json
[outbound/segment.status.updated.schema.json]: ./outbound/segment.status.updated.schema.json
