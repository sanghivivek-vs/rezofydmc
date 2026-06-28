import { AuthService } from './auth.service';
import { OrgService } from './org.service';
import { UserService } from './user.service';
import type { AuthClaims, TokenService } from './token.service';
import { InMemoryOrgRepository } from '../repository/org.repository';
import { InMemoryUserRepository } from '../repository/user.repository';
import { fixedClock } from '@common/clock/clock';
import { sequentialIdGenerator } from '@common/ids/id';

class FakeTokenService implements TokenService {
  sign(claims: AuthClaims): string {
    return `tok:${claims.sub}:${claims.orgId}:${claims.role}`;
  }
  verify(token: string): AuthClaims {
    const [, sub, orgId, role] = token.split(':');
    return { sub, orgId, role: role as AuthClaims['role'] };
  }
}

function makeAuth() {
  const orgs = new OrgService({
    repository: new InMemoryOrgRepository(),
    clock: fixedClock('2026-06-28T10:00:00.000Z'),
    idGenerator: sequentialIdGenerator(),
  });
  const users = new UserService({
    repository: new InMemoryUserRepository(),
    clock: fixedClock('2026-06-28T10:00:00.000Z'),
    idGenerator: sequentialIdGenerator(),
  });
  return new AuthService(orgs, users, new FakeTokenService());
}

const registration = {
  org: { name: 'Alpine DMC', defaultCurrency: 'CHF' },
  owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
};

describe('AuthService', () => {
  it('bootstraps an org with an Owner user and returns a token', async () => {
    const auth = makeAuth();
    const result = await auth.registerOrg(registration);
    expect(result.organization.name).toBe('Alpine DMC');
    expect(result.organization.settings.defaultCurrency).toBe('CHF');
    expect(result.owner.role).toBe('Owner');
    expect(result.owner).not.toHaveProperty('passwordHash');
    expect(result.token).toContain(result.owner.id);
  });

  it('logs in with correct credentials', async () => {
    const auth = makeAuth();
    await auth.registerOrg(registration);
    const login = await auth.login('owner@alpine.test', 'password123');
    expect(login).not.toBeNull();
    expect(login?.user.email).toBe('owner@alpine.test');
    expect(login?.token).toContain(login?.user.id);
  });

  it('rejects wrong password and unknown email identically (null)', async () => {
    const auth = makeAuth();
    await auth.registerOrg(registration);
    expect(await auth.login('owner@alpine.test', 'wrong')).toBeNull();
    expect(await auth.login('nobody@alpine.test', 'password123')).toBeNull();
  });

  it('is case-insensitive on the login email', async () => {
    const auth = makeAuth();
    await auth.registerOrg(registration);
    expect(await auth.login('OWNER@ALPINE.TEST', 'password123')).not.toBeNull();
  });
});
