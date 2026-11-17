import type { Account } from "@spotcheck/shared";
export interface GoogleIdentity { readonly sub: string; readonly email: string; readonly displayName: string; readonly nonce: string; }
export interface GoogleIdentityVerifier { verify(credential: string): Promise<GoogleIdentity>; }
export interface IdentityRepository {
  register(identity: GoogleIdentity): Promise<Account>;
  findAccount(userId: string): Promise<Account | null>;
}
export class AccessError extends Error {
  constructor(readonly statusCode: 401 | 403 | 503, message: string) { super(message); this.name = "AccessError"; }
}
