import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { canvasListResponseSchema, canvasResponseSchema, createdCanvasResponseSchema, pinResponseSchema, commentResponseSchema, publicConfigSchema } from "@spotcheck/shared";
import type { InjectOptions } from "fastify";
import { CookieSessions } from "../src/infrastructure/auth/CookieSessions";
import { createApp } from "../src/presentation/createApp";
import { readConfig } from "../src/infrastructure/config/environment";
import { PrismaCanvasRepository } from "../src/infrastructure/repositories/PrismaCanvasRepository";
import { ConcurrentCanvasUpdateError } from "../src/application/errors";

const UI = "http://localhost:3000";
const AUTHOR = { id: "reviewer-test", displayName: "QA" };
function form(fields: Record<string, string>, file?: { bytes: Buffer; type: string }) {
  const boundary = "spotcheck-test-boundary";
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  if (file) { chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="fixture.png"\r\nContent-Type: ${file.type}\r\n\r\n`)); chunks.push(file.bytes, Buffer.from("\r\n")); }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}`, origin: UI } };
}
const fields = { sourceType: "web", title: "HTTP QA", url: "https://example.test/start", viewportWidth: "1280", viewportHeight: "800", deviceScaleFactor: "1", userAgent: "QA" };
const point = (pageRoute = "/start") => ({ x: 0.4, y: 0.3, pageRoute, author: AUTHOR, snapshot: { reviewedUrl: `https://example.test${pageRoute}`, viewport: { width: 1280, height: 800 }, scrollOffset: { x: 0, y: 80 }, browser: { name: "QA" }, operatingSystem: { name: "QA OS" } } });

test("HTTP API preserves CRUD, capabilities, CORS, storage and error contracts", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "spotcheck-backend-http-"));
  const database = new PrismaClient({ datasources: { db: { url: `file:${path.join(directory, "test.db")}` } } });
  const migrations = path.join(process.cwd(), "prisma", "migrations");
  for (const migration of (await readdir(migrations)).filter((name) => /^\d/.test(name)).sort()) {
    const sql = await readFile(path.join(migrations, migration, "migration.sql"), "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await database.$executeRawUnsafe(statement);
  }
  const config = readConfig({ DATABASE_URL: `file:${path.join(directory, "test.db")}`, UPLOAD_DIRECTORY: path.join(directory, "uploads"), FRONTEND_ORIGIN: UI, PUBLIC_API_ORIGIN: "http://localhost:4000", PROXY_ORIGIN: "http://localhost:3002", SESSION_SECRET: "test-only-secret-12345678901234567890" });
  await database.organization.create({ data: { id: "org-test", name: "Test team" } });
  await database.user.create({ data: { id: AUTHOR.id, googleSub: "google-test", email: "qa@example.test", displayName: AUTHOR.displayName, membership: { create: { organizationId: "org-test", status: "approved" } } } });
  const repository = new PrismaCanvasRepository(database, "org-test");
  const app = await createApp({ config, database, repository, repositoryForOrganization: () => repository });
  const cookie = new CookieSessions(config.sessionSecret, false, UI).issue(AUTHOR.id).split(";")[0];
  const inject = (input: InjectOptions) => app.inject({ ...input, headers: { origin: UI, cookie, ...input.headers } });
  let shareId = "";
  let pinId = "";
  let commentId = "";
  try {
    await t.test("health/config expose only public data and configured CORS origin", async () => {
      assert.equal((await inject({ method: "GET", url: "/health" })).statusCode, 200);
      const configResponse = await inject({ method: "GET", url: "/api/config", headers: { origin: UI } });
      assert.deepEqual(publicConfigSchema.parse(configResponse.json<unknown>()), { proxyOrigin: "http://localhost:3002", googleClientId: null, googleConfigured: false });
      assert.equal(configResponse.headers["access-control-allow-origin"], UI);
      assert.equal(configResponse.headers["access-control-allow-credentials"], "true");
      const preflight = await inject({ method: "OPTIONS", url: "/api/canvases", headers: { origin: UI, "access-control-request-method": "POST", "access-control-request-headers": "content-type" } });
      assert.equal(preflight.statusCode, 204);
      for (const origin of ["https://evil.example", "null", "http://localhost:3002"]) {
        assert.equal((await inject({ method: "POST", url: "/api/canvases", headers: { origin } })).statusCode, 403);
        assert.equal((await inject({ method: "OPTIONS", url: "/api/canvases", headers: { origin, "access-control-request-method": "POST" } })).statusCode, 403);
        const result = await inject({ method: "GET", url: "/api/canvases", headers: { origin } });
        assert.equal(result.headers["access-control-allow-origin"], undefined);
      }
    });
    await t.test("creates/list/loads approved team review, preserving status and unique DTO contracts", async () => {
      const response = await inject({ method: "POST", url: "/api/canvases", ...form(fields) });
      assert.equal(response.statusCode, 201, response.body);
      shareId = createdCanvasResponseSchema.parse(response.json<unknown>()).shareId;
      const listing = canvasListResponseSchema.parse((await inject({ method: "GET", url: "/api/canvases" })).json<unknown>());
      assert.equal(listing.canvases[0].shareId, shareId);
      const canvas = canvasResponseSchema.parse((await inject({ method: "GET", url: `/api/canvases/${shareId}` })).json<unknown>()).canvas;
      assert.equal(canvas.browserMetadata.pageTitle, fields.title);
      assert.equal((await inject({ method: "GET", url: "/api/canvases/unknown-capability" })).statusCode, 404);
      assert.equal((await inject({ method: "GET", url: `/api/canvases/${shareId}?pageRoute=` })).statusCode, 400);
    });
    await t.test("adds DOM/free pins, comments/replies, filters pages and resolves", async () => {
      const result = await inject({ method: "POST", url: `/api/canvases/${shareId}/pins`, payload: { ...point(), domAnchor: { selector: "#hero", offsetX: 0.5, offsetY: 0.5 } } });
      assert.equal(result.statusCode, 201, result.body);
      const pin = pinResponseSchema.parse(result.json<unknown>()).pin;
      pinId = pin.id;
      assert.equal(pin.pinNumber, 1);
      assert.equal(pin.domAnchor?.selector, "#hero");
      const second = await inject({ method: "POST", url: `/api/canvases/${shareId}/pins`, payload: point("/second") });
      const free = pinResponseSchema.parse(second.json<unknown>()).pin;
      assert.equal(free.pinNumber, 2);
      assert.equal(free.domAnchor, undefined);
      const comment = await inject({ method: "POST", url: `/api/canvases/${shareId}/pins/${pinId}/comments`, payload: { pageRoute: "/start", author: AUTHOR, body: "First comment" } });
      assert.equal(comment.statusCode, 201);
      commentId = commentResponseSchema.parse(comment.json<unknown>()).comment.id;
      const reply = await inject({ method: "POST", url: `/api/canvases/${shareId}/pins/${pinId}/comments`, payload: { pageRoute: "/start", author: AUTHOR, body: "Reply", replyToCommentId: commentId } });
      assert.equal(reply.statusCode, 201);
      assert.equal(commentResponseSchema.parse(reply.json<unknown>()).comment.replyToCommentId, commentId);
      const filtered = canvasResponseSchema.parse((await inject({ method: "GET", url: `/api/canvases/${shareId}?pageRoute=%2Fsecond` })).json<unknown>()).canvas;
      assert.deepEqual(filtered.pins.map((entry) => entry.pinNumber), [2]);
      assert.equal((await inject({ method: "POST", url: `/api/canvases/${shareId}/pins/${pinId}/comments`, payload: { pageRoute: "/second", author: AUTHOR, body: "wrong route" } })).statusCode, 404);
      const resolved = await inject({ method: "PATCH", url: `/api/canvases/${shareId}/pins/${pinId}`, payload: { pageRoute: "/start", resolvedBy: AUTHOR } });
      assert.equal(resolved.statusCode, 200);
      assert.equal(pinResponseSchema.parse(resolved.json<unknown>()).pin.status, "resolved");
      assert.equal((await inject({ method: "POST", url: `/api/canvases/${shareId}/pins/${pinId}/comments`, payload: { pageRoute: "/start", author: AUTHOR, body: "closed" } })).statusCode, 400);
    });
    await t.test("rejects malformed body, credentials, inconsistent route and optimistic conflict", async () => {
      assert.equal((await inject({ method: "POST", url: `/api/canvases/${shareId}/pins`, payload: "{", headers: { "content-type": "application/json" } })).statusCode, 400);
      assert.equal((await inject({ method: "POST", url: `/api/canvases/${shareId}/pins`, payload: { ...point(), x: -1 } })).statusCode, 400);
      assert.equal((await inject({ method: "POST", url: `/api/canvases/${shareId}/pins`, payload: { ...point(), pageRoute: "/wrong" } })).statusCode, 400);
      assert.equal((await inject({ method: "POST", url: "/api/canvases", ...form({ ...fields, url: "https://user:secret@example.test" }) })).statusCode, 400);
      const save = repository.save.bind(repository);
      repository.save = async () => { throw new ConcurrentCanvasUpdateError("test"); };
      try { assert.equal((await inject({ method: "POST", url: `/api/canvases/${shareId}/pins`, payload: point() })).statusCode, 409); } finally { repository.save = save; }
      const list = repository.listSummaries.bind(repository);
      repository.listSummaries = async () => { throw new Error("private-credential"); };
      try { const result = await inject({ method: "GET", url: "/api/canvases" }); assert.equal(result.statusCode, 500); assert.ok(!result.body.includes("private-credential")); } finally { repository.listSummaries = list; }
    });
    await t.test("uploads and serves PNG safely; rejects fake, oversized and missing images", async () => {
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
      const response = await inject({ method: "POST", url: "/api/canvases", ...form({ ...fields, sourceType: "image", url: "" }, { bytes: png, type: "image/png" }) });
      assert.equal(response.statusCode, 201, response.body);
      const imageShare = createdCanvasResponseSchema.parse(response.json<unknown>()).shareId;
      const canvas = canvasResponseSchema.parse((await inject({ method: "GET", url: `/api/canvases/${imageShare}` })).json<unknown>()).canvas;
      assert.equal(canvas.imageSource.kind, "uploaded-path");
      if (canvas.imageSource.kind !== "uploaded-path") throw new Error("Expected uploaded image");
      assert.equal(canvas.browserMetadata.pageUrl, `http://localhost:4000${canvas.imageSource.path}`);
      const loaded = await inject({ method: "GET", url: canvas.imageSource.path });
      assert.equal(loaded.statusCode, 200);
      assert.equal(loaded.headers["x-content-type-options"], "nosniff");
      assert.deepEqual(loaded.rawPayload, png);
      assert.equal((await inject({ method: "GET", url: "/api/uploads/not-an-image" })).statusCode, 404);
      assert.equal((await inject({ method: "GET", url: "/api/uploads/00000000-0000-0000-0000-000000000000.png" })).statusCode, 404);
      for (const file of [{ bytes: Buffer.from("fake"), type: "image/png" }, { bytes: Buffer.alloc(10 * 1024 * 1024 + 1), type: "image/png" }]) assert.equal((await inject({ method: "POST", url: "/api/canvases", ...form({ ...fields, sourceType: "image", url: "" }, file) })).statusCode, 400);
    });
  } finally {
    await app.close();
    await database.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
