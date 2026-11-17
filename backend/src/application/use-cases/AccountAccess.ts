import type { Account } from "@spotcheck/shared";
import { AccessError, type GoogleIdentityVerifier, type IdentityRepository } from "../../domain/ports/IdentityRepository";
export class AccountAccess {
  constructor(private readonly identities: IdentityRepository, private readonly verifier: GoogleIdentityVerifier) {}
  async login(credential: string, nonce: string): Promise<Account> {
    let identity;
    try { identity = await this.verifier.verify(credential); } catch { throw new AccessError(401, "La credencial de Google no es válida."); }
    if (identity.nonce !== nonce) throw new AccessError(401, "La solicitud de acceso ha expirado. Inténtalo de nuevo.");
    return this.identities.register(identity);
  }
  async account(userId: string): Promise<Account> {
    const account = await this.identities.findAccount(userId);
    if (!account) throw new AccessError(401, "Inicia sesión para continuar.");
    return account;
  }
  async member(userId: string): Promise<Account & { organizationId: string }> {
    const account = await this.account(userId);
    if (!account.organizationId) throw new AccessError(503, "No se pudo preparar tu espacio. Vuelve a iniciar sesión.");
    return { ...account, organizationId: account.organizationId };
  }
}
