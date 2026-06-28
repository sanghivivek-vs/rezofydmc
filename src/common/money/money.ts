/**
 * Money — integer minor units + ISO 4217 currency code.
 *
 * Binding rule (Build guide §0, §9): money is NEVER a float. We store an integer
 * count of the currency's minor unit (e.g. cents for USD/EUR/CHF, paise for INR,
 * whole yen for JPY which has 0 minor digits) plus the currency code. All
 * arithmetic happens in minor units so we never accumulate floating-point error.
 */

export type CurrencyCode = string; // ISO 4217, e.g. "USD", "EUR", "CHF", "INR", "JPY"

export interface Money {
  /** Integer count of minor units. MUST be a safe integer. */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

function assertInteger(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(
      `Money.amountMinor must be a safe integer (minor units); received ${amountMinor}`,
    );
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      `Currency mismatch: cannot operate on ${a.currency} and ${b.currency}. ` +
        `Convert via the costing engine's FX step first.`,
    );
  }
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  assertInteger(amountMinor);
  if (!currency || currency.length !== 3) {
    throw new MoneyError(`Currency must be a 3-letter ISO 4217 code; received "${currency}"`);
  }
  return { amountMinor, currency: currency.toUpperCase() };
}

export function zero(currency: CurrencyCode): Money {
  return money(0, currency);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/** Sum a list of Money values. Requires at least one element or an explicit currency. */
export function sum(values: Money[], currencyIfEmpty?: CurrencyCode): Money {
  if (values.length === 0) {
    if (!currencyIfEmpty) {
      throw new MoneyError('sum() of an empty list requires currencyIfEmpty');
    }
    return zero(currencyIfEmpty);
  }
  return values.reduce((acc, v) => add(acc, v));
}

/**
 * Multiply money by a whole quantity. Quantity must be an integer (e.g. pax,
 * nights, vehicles). Fractional scaling (markup %, FX, child %) goes through
 * {@link scale} so the rounding mode is explicit.
 */
export function multiply(a: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new MoneyError(
      `multiply() quantity must be an integer; received ${quantity}. ` +
        `Use scale() for fractional factors.`,
    );
  }
  return money(a.amountMinor * quantity, a.currency);
}

export type RoundingMode = 'half-up' | 'half-even' | 'bankers';

/**
 * Round a real number of minor units to an integer using the given mode.
 * Default is half-up (round half away from zero is avoided; we round half toward
 * +∞ for positive and toward -∞... — we use symmetric half-up: 0.5 -> 1, -0.5 -> -1).
 */
export function roundMinor(value: number, mode: RoundingMode = 'half-up'): number {
  if (mode === 'half-even' || mode === 'bankers') {
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // exactly .5 -> round to even
    return floor % 2 === 0 ? floor : floor + 1;
  }
  // half-up, symmetric around zero
  return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * Scale money by a real factor (FX rate, markup multiplier, child %), rounding
 * the result back to integer minor units with an explicit rounding mode.
 *
 * The caller is responsible for recording the factor used (e.g. the FX rate)
 * — see costing engine. This function does the arithmetic only.
 */
export function scale(a: Money, factor: number, mode: RoundingMode = 'half-up'): Money {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`scale() factor must be finite; received ${factor}`);
  }
  return money(roundMinor(a.amountMinor * factor, mode), a.currency);
}

/**
 * Convert money to another currency using a stored FX rate. The rate is the
 * multiplier applied to minor units: targetMinor = round(sourceMinor * rate).
 * The rate already accounts for any difference in minor-unit exponents between
 * the two currencies, and MUST be recorded by the caller (do not recompute
 * silently — Build guide §5).
 */
export function convert(
  a: Money,
  targetCurrency: CurrencyCode,
  rate: number,
  mode: RoundingMode = 'half-up',
): Money {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new MoneyError(`FX rate must be a non-negative finite number; received ${rate}`);
  }
  if (a.currency === targetCurrency) {
    return a;
  }
  return money(roundMinor(a.amountMinor * rate, mode), targetCurrency.toUpperCase());
}

export function isZero(a: Money): boolean {
  return a.amountMinor === 0;
}

export function isNegative(a: Money): boolean {
  return a.amountMinor < 0;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

/** Human-readable, for logs/debugging only — not for accounting output. */
export function formatDebug(a: Money): string {
  return `${a.amountMinor} ${a.currency} (minor)`;
}

/**
 * Display formatting for documents/UI, e.g. "2400.00 CHF". `fractionDigits` is
 * the currency's minor-unit exponent (default 2; pass 0 for JPY). This is a
 * presentation helper — accounting always uses integer minor units.
 */
export function formatMoney(a: Money, fractionDigits = 2): string {
  const major = a.amountMinor / 10 ** fractionDigits;
  return `${major.toFixed(fractionDigits)} ${a.currency}`;
}
