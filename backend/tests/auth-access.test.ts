import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { accountSchema, canvasResponseSchema, commentResponseSchema, createdCanvasResponseSchema, pinResponseSchema } from "@spotcheck/shared";
import { GoogleIdentityVerifier } from "../src/infrastructure/auth/GoogleIdentityVerifier";
import { readConfig } from "../src/infrastructure/config/environment";
import { CookieSessions } from "../src/infrastructure/auth/CookieSessions";
import { authFixture, multipart, point, projectFields, spoofedAuthor, TEST_SECRET, UI } from "./fixtures/auth";

test("Google login uses one-use nonce, trusted identity, private cookies and origin guards", async () => {
  let nonce = "";
  const fixture = await authFixture({ async verify(credential) {
    if (["invalid", "expired", "wrong-audience"].includes(credential)) throw new Error("Google verification rejected token");
    return { sub: "verified-google-sub", email: "verified@example.test", displayName: "Verified name", nonce: credential === "wrong-nonce" ? "different" : nonce };
  } });
  try {
    const { app, database } = fixture;
    assert.equal((await app.inject({ method: "GET", url: "/api/canvases" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/api/auth/google", payload: { credential: "valid" }, headers: { origin: "https://evil.test" } })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/auth/google", payload: { credential: "valid" }, headers: { origin: UI } })).statusCode, 401);
    for (const credential of ["invalid", "expired", "wrong-audience", "wrong-nonce"]) {
      const challenge = await app.inject({ method: "GET", url: "/api/auth/challenge" });
      nonce = challenge.json<{ nonce: string }>().nonce;
      const cookie = String(challenge.headers["set-cookie"]).split(";")[0];
      const result = await app.inject({ method: "POST", url: "/api/auth/google", headers: { origin: UI, cookie }, payload: { credential } });
      assert.equal(result.statusCode, 401, credential);
      assert.equal((await database.user.count()), 0);
    }
    const challenge = await app.inject({ method: "GET", url: "/api/auth/challenge" });
    nonce = challenge.json<{ nonce: string }>().nonce;
    const cookie = String(challenge.headers["set-cookie"]).split(";")[0];
    const login = await app.inject({ method: "POST", url: "/api/auth/google", headers: { origin: UI, cookie }, payload: { credential: "valid" } });
    assert.equal(login.statusCode, 200, login.body);
    const account = accountSchema.parse(login.json<{ account: unknown }>().account);
    assert.equal(account.status, "approved"); assert.equal(account.organizationId, `personal-${account.id}`);
    assert.equal(account.displayName, "Verified name");
    const cookies = login.headers["set-cookie"];
    assert.ok(Array.isArray(cookies));
    const session = cookies.find(value => value.startsWith("spotcheck_session="));
    assert.ok(session);
    assert.ok(session.includes("HttpOnly")); assert.ok(session?.includes("SameSite=Lax")); assert.ok(session?.includes("Path=/api"));
    assert.ok(!login.body.includes("credential"));
    assert.equal((await app.inject({ method: "POST", url: "/api/auth/google", headers: { origin: UI, cookie }, payload: { credential: "valid" } })).statusCode, 401);
    const sessionCookie = session.split(";")[0];
    assert.equal((await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: sessionCookie } })).statusCode, 200);
    assert.equal((await app.inject({ method: "GET", url: "/api/canvases", headers: { cookie: sessionCookie } })).statusCode, 200);
    const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { origin: UI, cookie: sessionCookie } });
    assert.equal(logout.statusCode, 200); assert.match(String(logout.headers["set-cookie"]), /Max-Age=0/);
    const forged = await app.inject({ method: "POST", url: "/api/auth/google", headers: { origin: UI, cookie }, payload: { credential: "valid", organizationId: "org-a", status: "approved" } });
    assert.equal(forged.statusCode, 400);
    assert.equal((await database.user.findUniqueOrThrow({ where: { id: account.id }, include: { membership: true } })).membership?.organizationId, account.organizationId);
    const preflight = await app.inject({ method: "OPTIONS", url: "/api/auth/google", headers: { origin: UI, "access-control-request-method": "POST", "access-control-request-headers": "content-type" } });
    assert.equal(preflight.statusCode, 204); assert.equal(preflight.headers["access-control-allow-credentials"], "true");
  } finally { await fixture.cleanup(); }
});

test("session JWT rejects expired/forged tokens and production cookies are Secure", async () => {
  const sessions = new CookieSessions(TEST_SECRET, true, UI);
  assert.match(sessions.issue("user"), /; Secure$/);
  assert.equal(readConfig({ DATABASE_URL: "postgresql://test:test@localhost:5432/test", NODE_ENV: "production", PUBLIC_API_ORIGIN: "https://api.example.test", SESSION_COOKIE_SECURE: "false" }).cookieSecure, true);
  const expired = jwt.sign({ kind: "session" }, TEST_SECRET, { algorithm: "HS256", subject: "user", issuer: "spotcheck-backend", audience: UI, expiresIn: -1 });
  assert.throws(() => sessions.userId(`spotcheck_session=${expired}`));
  assert.throws(() => sessions.userId("spotcheck_session=forged"));
  const wrongAudience = jwt.sign({ kind: "session" }, TEST_SECRET, { algorithm: "HS256", subject: "user", issuer: "spotcheck-backend", audience: "https://other.test", expiresIn: 60 });
  assert.throws(() => sessions.userId(`spotcheck_session=${wrongAudience}`));
  await assert.rejects(new GoogleIdentityVerifier("test-client").verify("not-a-jwt"));
});

test("Google users share within their team; other organizations and unassigned legacy projects remain private", async () => {
  const fixture = await authFixture();
  try {
    const { database, inject, user } = fixture;
    await database.organization.createMany({ data: [{ id: "org-a", name: "A" }, { id: "org-b", name: "B" }] });
    await user("alice", "org-a"); await user("bob", "org-a"); await user("mallory", "org-b"); await user("pending", "org-a", "pending"); await user("rejected", "org-a", "rejected");
    const created = await inject("alice", { method: "POST", url: "/api/canvases", ...multipart(projectFields) });
    assert.equal(created.statusCode, 201, created.body);
    const project = createdCanvasResponseSchema.parse(created.json<unknown>());
    const base = `/api/canvases/${project.shareId}`;
    const listed = await inject("bob", { method: "GET", url: "/api/canvases" });
    assert.ok(listed.body.includes(project.shareId));
    assert.ok(!(await inject("mallory", { method: "GET", url: "/api/canvases" })).body.includes(project.shareId));
    assert.equal((await inject("bob", { method: "GET", url: base })).statusCode, 200);
    for (const id of ["pending", "rejected"]) assert.equal((await inject(id, { method: "GET", url: base })).statusCode, 200);
    assert.equal((await inject("mallory", { method: "GET", url: base })).statusCode, 404);
    const added = await inject("alice", { method: "POST", url: `${base}/pins`, payload: { ...point, organizationId: "org-b" } });
    assert.equal(added.statusCode, 201, added.body);
    const pin = pinResponseSchema.parse(added.json<unknown>()).pin;
    assert.equal(pin.createdBy.id, "alice");
    assert.equal(pin.createdBy.displayName, "alice");
    const comment = await inject("bob", { method: "POST", url: `${base}/pins/${pin.id}/comments`, payload: { pageRoute: "/start", body: "Team comment", author: spoofedAuthor } });
    const first = commentResponseSchema.parse(comment.json<unknown>()).comment;
    assert.equal(first.author.id, "bob");
    const reply = await inject("alice", { method: "POST", url: `${base}/pins/${pin.id}/comments`, payload: { pageRoute: "/start", body: "Team reply", author: spoofedAuthor, replyToCommentId: first.id } });
    assert.equal(commentResponseSchema.parse(reply.json<unknown>()).comment.replyToCommentId, first.id);
    const current = canvasResponseSchema.parse((await inject("bob", { method: "GET", url: base })).json<unknown>()).canvas;
    assert.equal(current.pins[0].comments.length, 2);
    for (const input of [
      { method: "POST" as const, url: `${base}/pins`, payload: point },
      { method: "POST" as const, url: `${base}/pins/${pin.id}/comments`, payload: { pageRoute: "/start", body: "Attack", author: spoofedAuthor } },
      { method: "PATCH" as const, url: `${base}/pins/${pin.id}`, payload: { pageRoute: "/start", resolvedBy: spoofedAuthor } },
    ]) assert.equal((await inject("mallory", input)).statusCode, 404);
    const resolved = await inject("bob", { method: "PATCH", url: `${base}/pins/${pin.id}`, payload: { pageRoute: "/start", resolvedBy: spoofedAuthor } });
    assert.equal(pinResponseSchema.parse(resolved.json<unknown>()).pin.resolvedBy?.id, "bob");
    await database.organizationMembership.update({ where: { userId: "bob" }, data: { organizationId: "org-b" } });
    assert.equal((await inject("bob", { method: "GET", url: base })).statusCode, 404);
    const legacy = await database.canvas.update({ where: { id: project.id }, data: { organizationId: null } });
    assert.equal((await inject("alice", { method: "GET", url: base })).statusCode, 404);
    assert.equal(await database.pin.count({ where: { canvasId: legacy.id } }), 1);
    assert.equal(await database.comment.count(), 2);
  } finally { await fixture.cleanup(); }
});

test("uploaded images require a Google session and the current team; never public cache", async () => {
  const fixture = await authFixture();
  try {
    const { database, user, inject, app } = fixture;
    await database.organization.createMany({ data: [{ id: "org-a", name: "A" }, { id: "org-b", name: "B" }] });
    await user("alice", "org-a"); await user("other", "org-b");
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
    const response = await inject("alice", { method: "POST", url: "/api/canvases", ...multipart({ ...projectFields, sourceType: "image", url: "" }, image) });
    assert.equal(response.statusCode, 201, response.body);
    const project = createdCanvasResponseSchema.parse(response.json<unknown>());
    const canvas = canvasResponseSchema.parse((await inject("alice", { method: "GET", url: `/api/canvases/${project.shareId}` })).json<unknown>()).canvas;
    if (canvas.imageSource.kind !== "uploaded-path") throw new Error("Expected image");
    const loaded = await inject("alice", { method: "GET", url: canvas.imageSource.path });
    assert.equal(loaded.statusCode, 200); assert.equal(loaded.headers["cache-control"], "private, no-store");
    assert.deepEqual(loaded.rawPayload, image);
    assert.equal((await app.inject({ method: "GET", url: canvas.imageSource.path })).statusCode, 401);
    assert.equal((await inject("other", { method: "GET", url: canvas.imageSource.path })).statusCode, 404);
    await database.organizationMembership.update({ where: { userId: "alice" }, data: { status: "pending" } });
    assert.equal((await inject("alice", { method: "GET", url: canvas.imageSource.path })).statusCode, 200);
    await database.organizationMembership.update({ where: { userId: "alice" }, data: { organizationId: "org-b" } });
    assert.equal((await inject("alice", { method: "GET", url: canvas.imageSource.path })).statusCode, 404);
  } finally { await fixture.cleanup(); }
});
