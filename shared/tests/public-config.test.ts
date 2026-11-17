import assert from "node:assert/strict";
import test from "node:test";
import { publicConfigSchema } from "../src";

test("public configuration contains only public proxy and authentication settings", () => {
  assert.deepEqual(publicConfigSchema.parse({ proxyOrigin: null, googleClientId: null, googleConfigured: false }), { proxyOrigin: null, googleClientId: null, googleConfigured: false });
  assert.deepEqual(publicConfigSchema.parse({ proxyOrigin: "http://localhost:3002", googleClientId: null, googleConfigured: false }), { proxyOrigin: "http://localhost:3002", googleClientId: null, googleConfigured: false });
  assert.equal(publicConfigSchema.safeParse({ proxyOrigin: null, googleClientId: null, googleConfigured: false, privateApiKey: "not-public" }).success, false);
});
