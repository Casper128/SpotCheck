import type { Account, AuthChallenge, PublicConfig } from "@spotcheck/shared";
export interface AuthApi {
  config(): Promise<PublicConfig>;
  challenge(): Promise<AuthChallenge>;
  login(credential: string): Promise<Account>;
  me(): Promise<Account>;
  logout(): Promise<void>;
}
export interface GoogleSignIn {
  mount(element: HTMLElement, clientId: string, nonce: string, onCredential: (credential: string) => void): Promise<() => void>;
}
