/**
 * Secret resolution with fail-closed semantics (security hardening, ADR 0007).
 *
 * In production a missing secret is a hard error — we never fall back to a known
 * default value that an attacker could guess. In non-production we warn and use a
 * clearly-marked dev placeholder so local/test runs work without ceremony.
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function resolveSecret(value: string | undefined, name: string): string {
  if (value && value.length > 0) return value;
  if (isProduction()) {
    throw new Error(`Required secret ${name} is not set (refusing to start in production)`);
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[security] ${name} is not set — using an insecure dev placeholder. Set it in production.`,
  );
  return `dev-insecure-${name}`;
}
