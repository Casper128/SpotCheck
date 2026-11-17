import assert from "node:assert/strict";
import test from "node:test";
import { FetchReviewApi } from "../src/infrastructure/http/FetchReviewApi";
import { ReviewService } from "../src/application/ReviewService";
import { ReviewApiError } from "../src/domain/ports/ReviewApi";

const ORIGIN = "http://localhost:4000";
const timestamp = "2026-11-16T12:00:00.000Z";
const imagePath = "/api/uploads/00000000-0000-0000-0000-000000000000.png";
const canvas = { id: "canvas_1", shareId: "share_1", imageSource: { kind: "uploaded-path", path: imagePath }, browserMetadata: { pageUrl: `http://localhost:3001${imagePath}`, pageTitle: "Image", viewportWidth: 1280, viewportHeight: 800, capturedAt: timestamp }, createdAt: timestamp, updatedAt: timestamp, revision: 0, pins: [] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("HTTP adapter validates responses, encodes routes and includes HttpOnly session credentials", async () => {
  let requested = "";
  let credentials: RequestCredentials | undefined;
  const transport: typeof fetch = async (input, init) => { requested = String(input); credentials = init?.credentials; return json({ canvas }); };
  const api = new FetchReviewApi(ORIGIN, transport);
  const result = await api.getCanvas("share/1", "/products?q=x");
  assert.equal(result.id, canvas.id);
  assert.equal(requested, `${ORIGIN}/api/canvases/share%2F1?pageRoute=%2Fproducts%3Fq%3Dx`);
  assert.equal(credentials, "include");
  const invalid = new FetchReviewApi(ORIGIN, async () => json({ canvas: { ...canvas, revision: "wrong" } }));
  await assert.rejects(invalid.getCanvas("share_1"), /respuesta no válida/);
});

test("HTTP errors preserve status and safe messages; network/non-JSON failures are explicit", async () => {
  const missing = new FetchReviewApi(ORIGIN, async () => json({ error: "No existe" }, 404));
  await assert.rejects(missing.getCanvas("missing"), (error: unknown) => error instanceof ReviewApiError && error.status === 404 && error.message === "No existe");
  const malformed = new FetchReviewApi(ORIGIN, async () => new Response("bad gateway", { status: 502 }));
  await assert.rejects(malformed.listCanvases(), /respuesta no válida/);
  const offline = new FetchReviewApi(ORIGIN, async () => { throw new Error("internal network detail"); });
  await assert.rejects(offline.listCanvases(), /No se pudo conectar/);
});

test("create request uses multipart without forcing content-type and image URLs target API once", async () => {
  const api = new FetchReviewApi(ORIGIN, async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(init?.headers, undefined);
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get("viewportWidth"), "1280");
    assert.equal(init.body.get("sourceType"), "web");
    return json({ id: "canvas_new", shareId: "share_new" }, 201);
  });
  assert.equal((await api.createCanvas({ sourceType: "web", title: "Demo", viewportWidth: 1280, viewportHeight: 800, deviceScaleFactor: 1, userAgent: "QA", url: "https://example.test" })).shareId, "share_new");
  assert.equal(api.assetUrl(imagePath), ORIGIN + imagePath);
  assert.equal(api.assetUrl(ORIGIN + imagePath), ORIGIN + imagePath);
  assert.equal(api.assetUrl("http://old-monolith:3001" + imagePath), ORIGIN + imagePath);
  assert.throws(() => api.assetUrl("/api/uploads/../../secret"));
});

test("review service adapts legacy uploaded URLs", async () => {
  const service = new ReviewService(new FetchReviewApi(ORIGIN, async () => json({ canvas })));
  assert.equal((await service.loadReview("share_1")).browserMetadata.pageUrl, ORIGIN + imagePath);
  assert.equal(canvas.browserMetadata.pageUrl, "http://localhost:3001" + imagePath);
});

test("default browser fetch preserves its global receiver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = function (this: typeof globalThis) {
    assert.equal(this, globalThis);
    return Promise.resolve(json({ canvases: [] }));
  };
  try { assert.deepEqual(await new FetchReviewApi(ORIGIN).listCanvases(), []); }
  finally { globalThis.fetch = original; }
});
