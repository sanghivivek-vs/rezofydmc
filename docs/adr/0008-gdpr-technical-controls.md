# ADR 0008 — GDPR technical controls

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

The platform stores personal data for two subject classes (confirmed scope):
**DMC staff users** (the org is controller) and **travellers** whose data is
captured in enquiries/itineraries (the DMC is typically controller, this platform
the processor). We need the _technical_ controls that let a controller meet GDPR
data-subject rights. The organizational/legal side is out of code scope.

## Decision

- **PII classification** (`gdpr/domain/pii.ts`): a registry declaring each stored
  field as personal / special-category / credential. Drives the export surface
  and documents what erasure must cover. Exposed at `GET /v1/gdpr/pii-registry`.
- **Each bounded context owns erasure/export of its own data** (module boundary):
  `UserService.exportPersonalData/anonymise`, `EnquiryService.exportPersonalData/
eraseSubjectData`, `ItineraryService.redactPersonalData`. `GdprService`
  orchestrates them; it never reaches into another module's tables.
- **Right of access (DSAR):** `GET /v1/gdpr/users/:id/export` and
  `/enquiries/:id/export` return a structured export of the subject's data.
- **Right to erasure:** `POST …/erase` **anonymises in place** (tombstone PII,
  clear credentials, disable account; clear free-text/special-category fields and
  minors' ages on enquiries; redact itinerary notes). We anonymise rather than
  hard-delete to preserve referential integrity and the audit trail — an accepted
  GDPR approach. Operations are idempotent.
- **Consent / lawful basis** (`consent_record`): per-subject records of Art. 6
  basis, purpose, grant, and who/when. `POST/GET /v1/gdpr/consent`.
- **Retention/minimization:** `POST /v1/gdpr/retention/sweep` erases traveller PII
  on closed enquiries (Won/Lost/Expired) older than a retention window. `asOf` is
  caller-supplied so the sweep is deterministic; run it on a schedule in
  production.
- **Read-access auditing:** exports and erasures emit audit events
  (`data.exported`, `data.erased`, `consent.recorded`) — closing the previous gap
  of auditing only mutations. All GDPR endpoints are **Owner-only** (except the
  registry and consent capture) and tenant-scoped.

## Out of scope (organizational / deployment)

- Encryption at rest (DB/disk) and in transit (TLS) — deployment-level; flagged
  in ADR 0007. Field-level encryption of special-category data is a possible
  follow-up.
- DPA/sub-processor agreements, DPIA, appointing a DPO, data-residency, breach-
  notification process — legal/organizational, not code.
- Full read-access auditing on every GET (we audit the high-risk GDPR accesses).

## Consequences

- A controller can fulfil access/erasure/consent requests through the API.
- Anonymise-in-place keeps quotes/audit history valid after a subject is erased.
- The PII registry makes the data map explicit and reviewable.
