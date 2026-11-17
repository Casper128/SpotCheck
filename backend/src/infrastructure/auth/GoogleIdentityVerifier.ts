import { OAuth2Client } from "google-auth-library";
import type { GoogleIdentity, GoogleIdentityVerifier as IdentityVerifier } from "../../domain/ports/IdentityRepository";
export class GoogleIdentityVerifier implements IdentityVerifier {
  private readonly client = new OAuth2Client();
  constructor(private readonly clientId: string | null) {}
  async verify(credential: string): Promise<GoogleIdentity> {
    if (!this.clientId) throw new Error("Google no está configurado.");
    const ticket = await this.client.verifyIdToken({ idToken: credential, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true || typeof payload.nonce !== "string") throw new Error("Identidad incompleta.");
    return { sub: payload.sub, email: payload.email, displayName: (payload.name?.trim() || payload.email).slice(0, 80), nonce: payload.nonce };
  }
}
