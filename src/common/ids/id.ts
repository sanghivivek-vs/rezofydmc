/**
 * Id generation.
 *
 * Services take an {@link IdGenerator} so ids are deterministic in tests. The
 * default uses crypto UUIDs with an optional type prefix (e.g. "enq_<uuid>").
 */

import { randomUUID } from 'crypto';

export type IdGenerator = (prefix?: string) => string;

export const uuidIdGenerator: IdGenerator = (prefix?: string) =>
  prefix ? `${prefix}_${randomUUID()}` : randomUUID();

/** Deterministic, monotonically-increasing generator for tests. */
export function sequentialIdGenerator(start = 1): IdGenerator {
  let n = start;
  return (prefix?: string) => {
    const id = `${prefix ?? 'id'}_${n}`;
    n += 1;
    return id;
  };
}
