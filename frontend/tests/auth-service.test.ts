import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../src/application/AuthService";
import { FetchAuthApi } from "../src/infrastructure/http/FetchAuthApi";
import { ReviewApiError } from "../src/domain/ports/ReviewApi";

test("authentication orchestration passes backend nonce to Google and uses cookie transport", async () => {
  const requests: string[] = [];
  const account = { id: "verified", email: "qa@example.test", displayName: "QA", organizationId: null, organizationName: null, status: "pending" };
  const api = new FetchAuthApi("http://localhost:4000", async (url, init) => {
    const path = new URL(String(url)).pathname; requests.push(path);
    assert.equal(init?.credentials, "include");
    const body = path.endsWith("challenge") ? { nonce: "nonce-from-server-123456" } : path.endsWith("logout") ? { ok: true } : { account };
    if (path.endsWith("google")) assert.equal(init?.body, JSON.stringify({ credential: "verified-id-token" }));
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const service = new AuthService(api, { async mount(_element, clientId, nonce, callback) { assert.equal(clientId, "public-client"); assert.equal(nonce, "nonce-from-server-123456"); callback("verified-id-token"); return () => {}; } });
  let received = "";
  await service.mountGoogle({} as HTMLElement, "public-client", value => { received = value; });
  assert.equal(received, "verified-id-token");
  assert.equal((await service.login(received)).status, "pending");
  assert.equal((await service.account()).organizationId, null);
  await service.logout();
  assert.deepEqual(requests, ["/api/auth/challenge", "/api/auth/google", "/api/auth/me", "/api/auth/logout"]);
});

test("unconfigured/expired authentication errors remain explicit without exposing tokens", async () => {
  const api = new FetchAuthApi("http://localhost:4000", async () => new Response(JSON.stringify({ error: "Inicia sesión" }), { status: 401 }));
  await assert.rejects(api.me(), (error: unknown) => error instanceof ReviewApiError && error.status === 401);
});
