import type { PrismaClient, Prisma } from "@prisma/client";
import type { Account } from "@spotcheck/shared";
import type { GoogleIdentity, IdentityRepository } from "../../domain/ports/IdentityRepository";
const include = { membership: { include: { organization: true } } } satisfies Prisma.UserInclude;
type Record = Prisma.UserGetPayload<{ include: typeof include }>;
function toAccount(user: Record): Account {
  const membership = user.membership;
  return { id: user.id, email: user.email, displayName: user.displayName,
    organizationId: membership?.organizationId ?? null, organizationName: membership?.organization.name ?? null,
    status: "approved" };
}
export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly database: PrismaClient) {}
  async register(identity: GoogleIdentity): Promise<Account> {
    return this.database.$transaction(async database => {
      const user = await database.user.upsert({ where: { googleSub: identity.sub },
        create: { googleSub: identity.sub, email: identity.email, displayName: identity.displayName },
        update: { email: identity.email, displayName: identity.displayName }, include });
      return this.withOrganization(database, user);
    });
  }
  async findAccount(id: string): Promise<Account | null> {
    const user = await this.database.user.findUnique({ where: { id }, include });
    if (!user) return null;
    if (user.membership) return toAccount(user);
    return this.database.$transaction(async database => {
      const current = await database.user.findUnique({ where: { id }, include });
      return current ? this.withOrganization(database, current) : null;
    });
  }
  private async withOrganization(database: Prisma.TransactionClient, user: Record): Promise<Account> {
    if (user.membership) return toAccount(user);
    // Personal spaces never merge unrelated Google accounts or claim legacy projects.
    const organizationId = `personal-${user.id}`;
    await database.organization.upsert({ where: { id: organizationId },
      create: { id: organizationId, name: `Espacio de ${user.displayName}` }, update: {} });
    const membership = await database.organizationMembership.upsert({ where: { userId: user.id },
      create: { userId: user.id, organizationId, status: "approved" }, update: {}, include: { organization: true } });
    return toAccount({ ...user, membership });
  }
}
