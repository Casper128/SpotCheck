import type { FastifyRequest } from "fastify";
import type { Account } from "@spotcheck/shared";
import type { AccountAccess } from "../../application/use-cases/AccountAccess";
import type { CookieSessions } from "../../infrastructure/auth/CookieSessions";
export class RequestAccess {
  private readonly accounts = new WeakMap<FastifyRequest, Account & { organizationId: string }>();
  constructor(readonly sessions: CookieSessions, readonly accountsService: AccountAccess) {}
  userId(request: FastifyRequest): string { return this.sessions.userId(request.headers.cookie); }
  async member(request: FastifyRequest): Promise<Account & { organizationId: string }> {
    const existing = this.accounts.get(request);
    if (existing) return existing;
    const account = await this.accountsService.member(this.userId(request));
    this.accounts.set(request, account);
    return account;
  }
}
