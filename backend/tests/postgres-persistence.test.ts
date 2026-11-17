import assert from "node:assert/strict";
import test from "node:test";
import { postgresFixture } from "./fixtures/postgres";
import { PrismaWorkspaceQuery } from "../src/infrastructure/repositories/PrismaWorkspaceQuery";

test("PostgreSQL workspace preserves dates, comments and organization isolation", async () => {
  const fixture = await postgresFixture();
  try {
    const db = fixture.database;
    await db.organization.createMany({ data: [{ id: "team", name: "Team" }, { id: "other", name: "Other" }] });
    for (const [id, organizationId] of [["alice", "team"], ["bob", "team"], ["outsider", "other"]]) {
      await db.user.create({ data: { id, googleSub: id, email: `${id}@example.test`, displayName: id, membership: { create: { organizationId, status: "approved" } } } });
    }
    const date = new Date("2026-01-02T03:04:05.123Z");
    await db.canvas.create({ data: { id: "project", shareId: "share", organizationId: "team", title: "Project", sourceType: "web", sourceUrl: "https://example.test/", viewportWidth: 1280, viewportHeight: 800, capturedAt: date,
      pins: { create: { id: "pin", pageRoute: "/", pinNumber: 1, x: 0.5, y: 0.5, createdById: "alice", createdByName: "alice", browserWidth: 1280, browserHeight: 800, browserName: "Test", operatingSystem: "Test", reviewedUrl: "https://example.test/", capturedAt: date,
        comments: { create: { id: "comment", authorId: "alice", authorName: "alice", body: "Shared comment", createdAt: date } } } } } });
    const query = new PrismaWorkspaceQuery(db);
    const workspace = (await query.execute("bob", "share")).workspace;
    assert.equal(workspace?.project.browserMetadata.capturedAt, date.toISOString());
    assert.equal(workspace?.project.pins[0].comments[0].body, "Shared comment");
    assert.equal(workspace?.project.pins[0].comments[0].createdAt, date.toISOString());
    assert.equal((await query.execute("outsider", "share")).workspace, null);
    assert.equal((await query.execute("unknown", "share")).actorId, null);
  } finally { await fixture.cleanup(); }
});
