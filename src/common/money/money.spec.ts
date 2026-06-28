import {
  money,
  zero,
  add,
  subtract,
  sum,
  multiply,
  scale,
  convert,
  roundMinor,
  equals,
  MoneyError,
} from './money';

describe('Money', () => {
  describe('construction', () => {
    it('accepts integer minor units and uppercases the currency', () => {
      const m = money(12345, 'usd');
      expect(m).toEqual({ amountMinor: 12345, currency: 'USD' });
    });

    it('rejects non-integer minor units (floats are forbidden)', () => {
      expect(() => money(12.5, 'USD')).toThrow(MoneyError);
    });

    it('rejects invalid currency codes', () => {
      expect(() => money(100, 'US')).toThrow(MoneyError);
      expect(() => money(100, '')).toThrow(MoneyError);
    });
  });

  describe('arithmetic', () => {
    it('adds and subtracts same-currency money', () => {
      expect(add(money(100, 'EUR'), money(250, 'EUR'))).toEqual(money(350, 'EUR'));
      expect(subtract(money(300, 'EUR'), money(100, 'EUR'))).toEqual(money(200, 'EUR'));
    });

    it('refuses to mix currencies', () => {
      expect(() => add(money(100, 'EUR'), money(100, 'USD'))).toThrow(/Currency mismatch/);
    });

    it('multiplies by whole quantities only', () => {
      expect(multiply(money(150, 'CHF'), 4)).toEqual(money(600, 'CHF'));
      expect(() => multiply(money(150, 'CHF'), 1.5)).toThrow(MoneyError);
    });

    it('sums a list and handles the empty case via explicit currency', () => {
      expect(sum([money(100, 'INR'), money(200, 'INR'), money(50, 'INR')])).toEqual(
        money(350, 'INR'),
      );
      expect(sum([], 'INR')).toEqual(zero('INR'));
      expect(() => sum([])).toThrow(MoneyError);
    });
  });

  describe('rounding', () => {
    it('half-up rounds .5 away from zero symmetrically', () => {
      expect(roundMinor(0.5, 'half-up')).toBe(1);
      expect(roundMinor(1.5, 'half-up')).toBe(2);
      expect(roundMinor(2.4, 'half-up')).toBe(2);
      expect(roundMinor(-0.5, 'half-up')).toBe(-1);
      expect(roundMinor(-2.5, 'half-up')).toBe(-3);
    });

    it('bankers rounding rounds half to even', () => {
      expect(roundMinor(0.5, 'bankers')).toBe(0);
      expect(roundMinor(1.5, 'bankers')).toBe(2);
      expect(roundMinor(2.5, 'bankers')).toBe(2);
      expect(roundMinor(3.5, 'bankers')).toBe(4);
    });
  });

  describe('scale (markup / fractional factors)', () => {
    it('applies a markup factor and rounds to minor units', () => {
      // 10000 minor * 1.175 (17.5% markup) = 11750
      expect(scale(money(10000, 'CHF'), 1.175)).toEqual(money(11750, 'CHF'));
    });

    it('rounds deterministically', () => {
      // 333 * 1.10 = 366.3 -> 366
      expect(scale(money(333, 'EUR'), 1.1)).toEqual(money(366, 'EUR'));
      // 335 * 1.10 = 368.5 -> 369 (half-up)
      expect(scale(money(335, 'EUR'), 1.1)).toEqual(money(369, 'EUR'));
    });
  });

  describe('convert (FX)', () => {
    it('converts using a stored rate and records target currency', () => {
      // 100000 minor CHF * 90.5 -> INR (rate folds in exponent handling)
      expect(convert(money(100000, 'CHF'), 'INR', 90.5)).toEqual(money(9050000, 'INR'));
    });

    it('is a no-op when currencies match', () => {
      const m = money(500, 'USD');
      expect(convert(m, 'USD', 1.23)).toBe(m);
    });

    it('rejects negative or non-finite rates', () => {
      expect(() => convert(money(1, 'USD'), 'EUR', -1)).toThrow(MoneyError);
      expect(() => convert(money(1, 'USD'), 'EUR', Infinity)).toThrow(MoneyError);
    });
  });

  describe('determinism', () => {
    it('produces identical output for identical inputs', () => {
      const run = () => scale(convert(money(123456, 'CHF'), 'EUR', 1.07), 1.18);
      expect(equals(run(), run())).toBe(true);
    });
  });
});
