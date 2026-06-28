import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the correct password', () => {
    const hash = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects the wrong password', () => {
    const hash = hashPassword('correct horse battery');
    expect(verifyPassword('Correct Horse Battery', hash)).toBe(false);
  });

  it('produces a salted hash (different each time)', () => {
    expect(hashPassword('passw0rd!')).not.toBe(hashPassword('passw0rd!'));
  });

  it('rejects too-short passwords', () => {
    expect(() => hashPassword('short')).toThrow(/at least 8/);
  });

  it('rejects malformed stored hashes without throwing', () => {
    expect(verifyPassword('x', 'not-a-valid-hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$16384$$')).toBe(false);
  });
});
