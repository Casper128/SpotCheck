import assert from "node:assert/strict";
import test from "node:test";
import { workspaceResponseSchema, createdCanvasResponseSchema, pinResponseSchema } from "@spotcheck/shared";
import { authFixture, multipart, point, projectFields, spoofedAuthor } from "./fixtures/auth";

const flushQueryEvents = async () => { await new Promise<void>(resolve => setImmediate(resolve)); await new Promise<void>(resolve => setImmediate(resolve)); };

test("workspace authorizes and assembles all routes, pins and comments with exactly one SQL query", async () => {
  const queries: string[] = [];
  const fixture = await authFixture(undefined, queries);
  try {
    const { database, user, inject, app } = fixture;
    await database.organization.createMany({ data: [{ id: "team-a", name: "A" }, { id: "team-b", name: "B" }] });
    await user("alice", "team-a"); await user("bob", "team-a"); await user("other", "team-b"); await user("pending", "team-a", "pending");
    const project = createdCanvasResponseSchema.parse((await inject("alice", { method: "POST", url: "/api/canvases", ...multipart(projectFields) })).json<unknown>());
    const base = `/api/canvases/${project.shareId}`;
    const first = pinResponseSchema.parse((await inject("alice", { method: "POST", url: `${base}/pins`, payload: point })).json<unknown>()).pin;
    const second = pinResponseSchema.parse((await inject("alice", { method: "POST", url: `${base}/pins`, payload: { ...point, pageRoute: "/other", snapshot: { ...point.snapshot, reviewedUrl: "https://example.test/other" } } })).json<unknown>()).pin;
    for (const body of ["one", "two"]) assert.equal((await inject("bob", { method: "POST", url: `${base}/pins/${first.id}/comments`, payload: { body, pageRoute: "/start", author: spoofedAuthor } })).statusCode, 201);
    assert.equal((await inject("bob", { method: "PATCH", url: `${base}/pins/${second.id}`, payload: { pageRoute: "/other", resolvedBy: spoofedAuthor } })).statusCode, 200);
    await flushQueryEvents();
    queries.length = 0;
    const response = await inject("bob", { method: "GET", url: `/api/projects/${project.shareId}/workspace` });
    assert.equal(response.statusCode, 200, response.body);
    await flushQueryEvents();
    assert.equal(queries.length, 1, queries.join("\n"));
    const { workspace } = workspaceResponseSchema.parse(response.json<unknown>());
    assert.equal(workspace.siteUrl, projectFields.url);
    assert.deepEqual(workspace.project.pins.map(pin => pin.pinNumber), [1, 2]);
    assert.equal(workspace.project.pins[0].comments.length, 2);
    assert.equal(workspace.project.pins[1].status, "resolved");
    assert.deepEqual(workspace.routes, [{ path: "/other", pinCount: 1, openPinCount: 0 }, { path: "/start", pinCount: 1, openPinCount: 1 }]);
    for (const [actor, status, identifier] of [["alice", 200, project.id], ["other", 404, project.id], ["pending", 200, project.shareId], ["alice", 404, "missing"], ["unknown-user", 401, project.id]] as const) {
      await flushQueryEvents();
      queries.length = 0;
      assert.equal((await inject(actor, { method: "GET", url: `/api/projects/${identifier}/workspace` })).statusCode, status);
      await flushQueryEvents();
      assert.equal(queries.length, 1, `${actor}: ${queries.join("\n")}`);
    }
    await flushQueryEvents();
    queries.length = 0;
    assert.equal((await app.inject({ method: "GET", url: `/api/projects/${project.id}/workspace` })).statusCode, 401);
    assert.equal(queries.length, 0);
    await database.organizationMembership.update({ where: { userId: "bob" }, data: { organizationId: "team-b" } });
    await flushQueryEvents();
    queries.length = 0;
    assert.equal((await inject("bob", { method: "GET", url: `/api/projects/${project.id}/workspace` })).statusCode, 404);
    await flushQueryEvents();
    assert.equal(queries.length, 1, queries.join("\n"));
  } finally { await fixture.cleanup(); }
});

test("empty workspace has no invented route and fixed site rejects new foreign pins while hiding old foreign snapshots without deletion", async () => {
  const fixture = await authFixture();
  try {
    const { database, user, inject } = fixture;
    await database.organization.create({ data: { id: "team", name: "Team" } }); await user("alice", "team");
    const project = createdCanvasResponseSchema.parse((await inject("alice", { method: "POST", url: "/api/canvases", ...multipart(projectFields) })).json<unknown>());
    const workspaceUrl = `/api/projects/${project.id}/workspace`;
    assert.deepEqual(workspaceResponseSchema.parse((await inject("alice", { method: "GET", url: workspaceUrl })).json<unknown>()).workspace.routes, []);
    const pinsUrl = `/api/canvases/${project.shareId}/pins`;
    assert.equal((await inject("alice", { method: "POST", url: pinsUrl, payload: { ...point, snapshot: { ...point.snapshot, reviewedUrl: "https://evil.test/start" } } })).statusCode, 400);
    assert.equal(await database.pin.count(), 0);
    const pin = pinResponseSchema.parse((await inject("alice", { method: "POST", url: pinsUrl, payload: point })).json<unknown>()).pin;
    await database.pin.update({ where: { id: pin.id }, data: { reviewedUrl: "https://old-foreign.test/start" } });
    const { workspace } = workspaceResponseSchema.parse((await inject("alice", { method: "GET", url: workspaceUrl })).json<unknown>());
    assert.equal(workspace.project.pins.length, 0); assert.deepEqual(workspace.routes, []);
    assert.equal(await database.pin.count(), 1);
    assert.equal((await inject("alice", { method: "POST", url: `${pinsUrl}/${pin.id}/comments`, payload: { body: "foreign", pageRoute: "/start", author: spoofedAuthor } })).statusCode, 404);
    await database.canvas.update({ where: { id: project.id }, data: { organizationId: null } });
    assert.equal((await inject("alice", { method: "GET", url: workspaceUrl })).statusCode, 404);
    assert.equal(await database.canvas.count(), 1);
  } finally { await fixture.cleanup(); }
});
