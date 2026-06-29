/**
 * Auth service (Build guide §4, §9). Issues bearer tokens on login and bootstraps
 * a new organization with its first Owner user.
 */

import { ForbiddenError } from '@common/errors/errors';
import type { CreateOrgInput, Organization } from '../domain/organization';
import { type PublicUser, type User, toPublicUser } from '../domain/user';
import type { OrgService } from './org.service';
import type { UserService } from './user.service';
import type { TokenService } from './token.service';

export interface LoginResult {
  readonly token: string;
  readonly user: PublicUser;
}

export interface RegisterOrgInput {
  readonly org: CreateOrgInput;
  readonly owner: { email: string; name: string; password: string };
}

export interface RegisterOrgResult {
  readonly organization: Organization;
  readonly owner: PublicUser;
  readonly token: string;
}

export class AuthService {
  constructor(
    private readonly orgs: OrgService,
    private readonly users: UserService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult | null> {
    const user = await this.users.authenticate(email, password);
    if (!user) return null;
    // A platform-suspended tenant cannot log in (any of its users).
    const org = await this.orgs.getByIdForPlatform(user.orgId);
    if (org.status === 'suspended') {
      throw new ForbiddenError(
        'This organization has been suspended. Contact the platform operator.',
      );
    }
    return { token: this.issue(user), user: toPublicUser(user) };
  }

  /**
   * Bootstrap a brand-new tenant: create the org, then its first Owner user, then
   * return a session token. No tenant context exists yet, so the owner is created
   * under a system context scoped to the new org.
   */
  async registerOrg(input: RegisterOrgInput): Promise<RegisterOrgResult> {
    const organization = await this.orgs.create(input.org);
    const systemCtx = {
      orgId: organization.id,
      userId: 'system:bootstrap',
      role: 'Owner' as const,
    };
    const owner = await this.users.create(systemCtx, {
      email: input.owner.email,
      name: input.owner.name,
      role: 'Owner',
      password: input.owner.password,
    });
    return { organization, owner: toPublicUser(owner), token: this.issue(owner) };
  }

  private issue(user: User): string {
    if (user.status !== 'active') {
      throw new ForbiddenError('User is disabled');
    }
    return this.tokens.sign({ sub: user.id, orgId: user.orgId, role: user.role });
  }
}
