import assert from "node:assert/strict";
import test from "node:test";
import { addPinRequestSchema, canvasSchema, createCanvasFieldsSchema, httpUrlSchema, reviewerSchema } from "../src";

test("contracts reject credentials, invalid coordinates and malformed reviewer input", () => {
  assert.equal(httpUrlSchema.safeParse("https://user:secret@example.com").success, false);
  assert.equal(httpUrlSchema.safeParse("file:///etc/passwd").success, false);
  assert.equal(reviewerSchema.safeParse({ id: "a", displayName: "  " }).success, false);
  assert.equal(addPinRequestSchema.safeParse({ x: -1, y: 0.5 }).success, false);
  const fields = createCanvasFieldsSchema.parse({ sourceType: "web", title: " Demo ", viewportWidth: "1280", viewportHeight: "800", deviceScaleFactor: "1", userAgent: "QA", url: "https://example.com" });
  assert.equal(fields.viewportWidth, 1280);
  assert.equal(fields.title, "Demo");
});

test("canvas JSON round-trip retains the unique shared contract and drops unknown fields", () => {
  const createdAt = "2026-11-16T12:00:00.000Z";
  const input = { id: "canvas_1", shareId: "share_1", imageSource: { kind: "external-url", url: "https://example.com/" }, browserMetadata: { pageUrl: "https://example.com/", pageTitle: "Demo", viewportWidth: 1280, viewportHeight: 800, capturedAt: createdAt }, createdAt, updatedAt: createdAt, revision: 0, pins: [], privateToken: "must-not-escape" };
  const parsed = canvasSchema.parse(JSON.parse(JSON.stringify(input)));
  assert.equal(parsed.shareId, "share_1");
  assert.deepEqual(parsed.pins, []);
  assert.equal("privateToken" in parsed, false);
  assert.equal(canvasSchema.safeParse({ ...input, revision: -1 }).success, false);
});
