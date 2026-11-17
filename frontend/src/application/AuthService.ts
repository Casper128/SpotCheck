import type { AuthApi, GoogleSignIn } from "../domain/ports/AuthApi";
export class AuthService {
  constructor(private readonly api: AuthApi, private readonly google: GoogleSignIn) {}
  configuration() { return this.api.config(); }
  account() { return this.api.me(); }
  login(credential: string) { return this.api.login(credential); }
  logout() { return this.api.logout(); }
  async mountGoogle(element: HTMLElement, clientId: string, onCredential: (credential: string) => void) {
    const { nonce } = await this.api.challenge();
    return this.google.mount(element, clientId, nonce, onCredential);
  }
}
