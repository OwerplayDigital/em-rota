/**
 * Money precision helpers for "Em Rota".
 *
 * Monetary values (BRL) are NEVER summed/subtracted as floating point:
 * e.g. `0.1 + 0.2 !== 0.3`, so cents are lost silently. All financial math
 * must run on integer cents (`toCents`) and only be converted back to a
 * display number with `fromCents` (which always yields a 2-decimal value).
 */

const parseValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let s = value.trim().replace('R$', '');
  if (s.includes(',') && s.includes('.')) {
    // pt-BR: dots are thousands separators, comma is the decimal separator
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Only a comma → treat it as the decimal separator (pt-BR)
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/** Convert a BRL value (number or string) to integer cents, rounding to the nearest cent. */
export const toCents = (value: number | string | null | undefined): number =>
  Math.round(parseValue(value) * 100);

/** Convert integer cents back to a BRL number with exactly 2 decimal places. */
export const fromCents = (cents: number): number => Math.round(cents) / 100;

/** Sum monetary values as integer cents; returns the total in cents. */
export const sumCents = (values: Array<number | string | null | undefined>): number =>
  values.reduce<number>((acc, v) => acc + toCents(v), 0);

/** Add two monetary values precisely; returns a BRL number with 2 decimals. */
export const addMoney = (
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): number => fromCents(toCents(a) + toCents(b));

/** Subtract `b` from `a` precisely; returns a BRL number with 2 decimals. */
export const subtractMoney = (
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): number => fromCents(toCents(a) - toCents(b));

/** Compare two monetary values: returns a signed difference in cents (0 = equal). */
export const compareMoney = (
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): number => toCents(a) - toCents(b);