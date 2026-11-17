import { postgresFixture } from "./postgres";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import type { InjectOptions } from "fastify";
import type { GoogleIdentityVerifier } from "../../src/domain/ports/IdentityRepository";
import { CookieSessions } from "../../src/infrastructure/auth/CookieSessions";
import { readConfig } from "../../src/infrastructure/config/environment";
import { createApp } from "../../src/presentation/createApp";
export const UI = "http://localhost:3000";
export const TEST_SECRET = "test-only-session-secret-12345678901234567890";
export const spoofedAuthor = { id: "attacker", displayName: "Not the real author" };
export const projectFields = { sourceType: "web", title: "Team project", url: "https://example.test/start", viewportWidth: "1280", viewportHeight: "800", deviceScaleFactor: "1", userAgent: "QA" };
export const point = { x: 0.4, y: 0.3, pageRoute: "/start", author: spoofedAuthor, snapshot: { reviewedUrl: "https://example.test/start", viewport: { width: 1280, height: 800 }, browser: { name: "QA" }, operatingSystem: { name: "QA" } } };
export function multipart(fields: Record<string, string>, image?: Buffer) {
  const boundary = "auth-test-boundary";
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  if (image) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`), image, Buffer.from("\r\n"));
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}
export async function authFixture(verifier?: GoogleIdentityVerifier, queries?: string[]) {
  const directory = await mkdtemp(path.join(tmpdir(), "spotcheck-auth-"));
  const postgres = await postgresFixture(queries);
  const { database } = postgres;
  const config = readConfig({ DATABASE_URL: postgres.databaseUrl, UPLOAD_DIRECTORY: path.join(directory, "uploads"), FRONTEND_ORIGIN: UI, GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com", SESSION_SECRET: TEST_SECRET });
  const app = await createApp({ config, database, googleVerifier: verifier });
  const sessions = new CookieSessions(TEST_SECRET, false, UI);
  const cookie = (id: string) => sessions.issue(id).split(";")[0];
  const inject = (id: string | null, input: InjectOptions) => app.inject({ ...input, headers: { origin: UI, ...(id ? { cookie: cookie(id) } : {}), ...input.headers } });
  const user = async (id: string, organizationId?: string, status = "approved") => database.user.create({ data: { id, googleSub: `google-${id}`, email: `${id}@example.test`, displayName: id,
    ...(organizationId ? { membership: { create: { organizationId, status } } } : {}) } });
  const cleanup = async () => { await app.close(); await postgres.cleanup(); await rm(directory, { recursive: true, force: true }); };
  return { app, database, config, sessions, cookie, inject, user, cleanup };
}
