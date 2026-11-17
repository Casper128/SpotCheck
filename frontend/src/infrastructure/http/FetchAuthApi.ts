import { z } from "zod";
import { authChallengeSchema, publicConfigSchema, sessionResponseSchema } from "@spotcheck/shared";
import type { AuthApi } from "../../domain/ports/AuthApi";
import { JsonApiClient } from "./JsonApiClient";
export class FetchAuthApi extends JsonApiClient implements AuthApi {
  config() { return this.request("/api/config", publicConfigSchema); }
  challenge() { return this.request("/api/auth/challenge", authChallengeSchema); }
  async login(credential: string) { return (await this.request("/api/auth/google", sessionResponseSchema, this.json("POST", { credential }))).account; }
  async me() { return (await this.request("/api/auth/me", sessionResponseSchema)).account; }
  async logout() { await this.request("/api/auth/logout", z.object({ ok: z.literal(true) }), this.json("POST", {})); }
}
