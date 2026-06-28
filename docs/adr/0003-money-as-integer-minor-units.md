# ADR 0003 — Money as integer minor units + ISO currency

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

Build guide §0 and §9: "Money is never a float. Store as integer minor units + an
ISO currency code. All arithmetic in minor units." Pricing correctness is
business-critical and must be deterministic (§5).

## Decision

- `Money = { amountMinor: integer, currency: ISO-4217 }`. See
  `src/common/money/money.ts`.
- All arithmetic (`add`, `subtract`, `multiply`, `sum`) operates on integer minor
  units and refuses to mix currencies.
- Fractional factors (markup %, child %, FX) go through `scale()` / `convert()`,
  which round back to integer minor units using an **explicit** rounding mode
  (default `half-up`; `bankers` available).
- **FX:** `convert(amount, target, rate)` multiplies minor units by a stored rate.
  The rate **folds in any minor-unit-exponent difference** between currencies and
  **must be recorded** by the caller — the engine never recomputes it silently
  (§5). The per-line FX rate used is recorded on `PricedLine.fxRate`.

## Consequences

- No floating-point drift in accounting.
- Rounding is a deliberate, tested decision rather than an accident of `number`.
- A future multi-exponent FX table (e.g. CHF↔JPY) is supported because the rate
  carries the exponent adjustment; if we later need per-currency exponent
  metadata for display formatting, that is an additive change.
