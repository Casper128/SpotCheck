import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { AccessError } from "../../domain/ports/IdentityRepository";
const ISSUER = "spotcheck-backend";
export class CookieSessions {
  readonly sessionName = "spotcheck_session";
  readonly challengeName = "spotcheck_challenge";
  private readonly challenges = new Map<string, number>();
  constructor(private readonly secret: string | null, private readonly secure: boolean, private readonly audience: string) {}
  private key(): string { if (!this.secret) throw new AccessError(503, "El acceso con Google aún no está configurado."); return this.secret; }
  cookie(name: string, value: string, maxAge: number): string {
    return `${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.secure ? "; Secure" : ""}`;
  }
  read(header: string | undefined, name: string): string | undefined {
    const part = header?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    try { return part ? decodeURIComponent(part.slice(name.length + 1)) : undefined; } catch { return undefined; }
  }
  private sign(kind: string, subject: string, expiresIn: number) { return jwt.sign({ kind }, this.key(), { algorithm: "HS256", subject, issuer: ISSUER, audience: this.audience, expiresIn }); }
  private verify(token: string | undefined, kind: string): string {
    try {
      if (!token) throw new Error();
      const payload = jwt.verify(token, this.key(), { algorithms: ["HS256"], issuer: ISSUER, audience: this.audience });
      if (typeof payload === "string" || payload.kind !== kind || !payload.sub) throw new Error();
      return payload.sub;
    } catch { throw new AccessError(401, "Inicia sesión para continuar."); }
  }
  issue(userId: string): string { return this.cookie(this.sessionName, this.sign("session", userId, 8 * 60 * 60), 8 * 60 * 60); }
  userId(header: string | undefined): string { return this.verify(this.read(header, this.sessionName), "session"); }
  challenge(): { nonce: string; cookie: string } {
    const now = Date.now();
    for (const [nonce, expiry] of this.challenges) if (expiry <= now) this.challenges.delete(nonce);
    if (this.challenges.size >= 1000) throw new AccessError(503, "Inténtalo de nuevo en unos minutos.");
    const nonce = randomBytes(32).toString("base64url");
    this.challenges.set(nonce, now + 5 * 60_000);
    return { nonce, cookie: this.cookie(this.challengeName, this.sign("challenge", nonce, 300), 300) };
  }
  consumeChallenge(header: string | undefined): string {
    const nonce = this.verify(this.read(header, this.challengeName), "challenge");
    const expiry = this.challenges.get(nonce);
    this.challenges.delete(nonce);
    if (!expiry || expiry <= Date.now()) throw new AccessError(401, "La solicitud de acceso ha expirado.");
    return nonce;
  }
}
