import assert from "node:assert/strict";
import test from "node:test";
import { publicConfigSchema } from "@spotcheck/shared";
import type { ReviewRepository } from "../src/application/ports/ReviewRepository";
import { readConfig } from "../src/infrastructure/config/environment";
import { createApp } from "../src/presentation/createApp";

const repository: ReviewRepository = {
  async create() {}, async findById() { return null; }, async findByShareId() { return null; }, async findMetadataByShareId() { return null; },
  async save() {}, async findPinsByCanvasIdAndPageRoute() { return []; }, async listSummaries() { return []; }, async rememberReviewer() {},
};
test("configuration endpoint exposes only public supported settings", async () => {
  const config = readConfig({ PROXY_ORIGIN: "http://localhost:3002", DATABASE_URL: "postgresql://private:private@localhost:5432/private" });
  const app = await createApp({ config, repository });
  try {
    const response = await app.inject({ method: "GET", url: "/api/config" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(publicConfigSchema.parse(response.json<unknown>()), { proxyOrigin: "http://localhost:3002", googleClientId: null, googleConfigured: false });
    assert.ok(!response.body.includes(config.databaseUrl));
  } finally { await app.close(); }
});
