import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectWorkspace, Pin, Account, AddPinRequest, Comment } from "@spotcheck/shared";
import { WorkspaceService } from "../src/application/WorkspaceService";
import { selectWorkspaceRoute } from "../src/application/workspaceNavigation";
import { ReviewApiError } from "../src/domain/ports/ReviewApi";
import type { WorkspaceApi } from "../src/domain/ports/WorkspaceApi";
const at = "2026-11-16T12:00:00.000Z";
const account = { id: "alice", organizationId: "team", status: "approved" } satisfies Pick<Account, "id" | "organizationId" | "status">;
const author = { id: "alice", displayName: "Alice" };
const pin: Pin = { id: "pin-1", pageRoute: "/home", pinNumber: 1, x: .5, y: .5, status: "open", createdBy: author, createdAt: at, snapshot: { reviewedUrl: "https://site.test/home", viewport: { width: 100, height: 100 }, browser: { name: "QA" }, operatingSystem: { name: "QA" } }, comments: [] };
const input: AddPinRequest = { ...pin, author };
const workspace: ProjectWorkspace = { project: { id: "project", shareId: "share", imageSource: { kind: "external-url", url: "https://site.test/home" }, browserMetadata: { pageUrl: "https://site.test/home", pageTitle: "Demo", viewportWidth: 100, viewportHeight: 100, capturedAt: at }, createdAt: at, updatedAt: at, revision: 0, pins: [pin] }, siteUrl: "https://site.test/home", routes: [{ path: "/home", pinCount: 1, openPinCount: 1 }] };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
function api(load: WorkspaceApi["getWorkspace"]): WorkspaceApi { return { getWorkspace: load, async addPin() { return { ...pin, id: "pin-2", pageRoute: "/second", pinNumber: 2 }; }, async addComment(_id, pinId) { return { id: "comment", pinId, author, body: "reply", createdAt: at } satisfies Comment; }, async resolvePin() { return { ...pin, status: "resolved", resolvedBy: author, resolvedAt: at }; }, assetUrl(path) { return `http://localhost:4000${path}`; } }; }

test("workspace deduplicates loads, switches pinned routes with no HTTP calls and updates mutations locally", async () => {
  const pending = deferred<ProjectWorkspace>(); let calls = 0;
  const service = new WorkspaceService(api(async () => { calls++; return pending.promise; })); service.setIdentity(account);
  const first = service.load("share"); const second = service.load("share"); assert.equal(first, second); assert.equal(calls, 1);
  pending.resolve(workspace); await first;
  assert.equal(await service.load("share"), workspace); assert.equal(calls, 1);
  assert.equal((await service.load("project")).project.id, "project"); assert.equal(calls, 1);
  assert.equal(selectWorkspaceRoute(service.snapshot("share")!, "/home").href, "https://site.test/home"); assert.equal(calls, 1);
  await service.addPin("share", input); assert.equal(calls, 1);
  assert.equal(service.snapshot("share")!.routes.length, 2);
  assert.equal(selectWorkspaceRoute(service.snapshot("share")!, "/second").href, "https://site.test/second"); assert.equal(calls, 1);
  await service.addComment("share", pin.id, { pageRoute: "/home", body: "reply", author });
  assert.equal(service.snapshot("share")!.project.pins[0].comments.length, 1);
  await service.resolvePin("share", pin.id, { pageRoute: "/home", resolvedBy: author });
  assert.equal(service.snapshot("share")!.routes.find(route => route.path === "/home")!.openPinCount, 0); assert.equal(calls, 1);
});

test("logout/organization changes invalidate memory and stale in-flight responses cannot repopulate it", async () => {
  const pending = deferred<ProjectWorkspace>(); let calls = 0;
  const service = new WorkspaceService(api(async () => { calls++; return pending.promise; })); service.setIdentity(account);
  const old = service.load("share"); service.setIdentity(null);
  assert.equal(service.snapshot("share"), null);
  pending.resolve(workspace); await assert.rejects(old, /sesión cambió/); assert.equal(service.snapshot("share"), null);
  service.setIdentity(account); await service.load("share");
  service.setIdentity({ ...account, organizationId: "other" }); assert.equal(service.snapshot("share"), null);
  assert.equal(calls, 2);
});

test("failed loads are retryable and late refreshes do not overwrite a completed mutation", async () => {
  const refresh = deferred<ProjectWorkspace>(); let calls = 0;
  const service = new WorkspaceService(api(async () => { calls++; if (calls === 1) throw new Error("offline"); if (calls === 2) return workspace; return refresh.promise; })); service.setIdentity(account);
  await assert.rejects(service.load("share"), /offline/); await service.load("share");
  const waiting = service.load("share", true); await service.addPin("share", input);
  refresh.resolve(workspace); await waiting;
  assert.equal(service.snapshot("share")!.project.pins.length, 2);
  service.setIdentity(null); assert.equal(service.snapshot("share"), null); await assert.rejects(service.load("share"), /Inicia sesión/);
});

test("authorization failures clear private cached data without allowing an old request to clear a new identity", async () => {
  let denied = false;
  const service = new WorkspaceService(api(async () => { if (denied) throw new ReviewApiError("Revoked", 403); return workspace; }));
  service.setIdentity(account); await service.load("share"); denied = true;
  await assert.rejects(service.load("share", true), /Revoked/); assert.equal(service.snapshot("share"), null);
  const pending = deferred<ProjectWorkspace>();
  const other = new WorkspaceService(api(async identifier => identifier === "old" ? pending.promise : workspace));
  other.setIdentity(account); const stale = other.load("old");
  other.setIdentity({ ...account, id: "bob" }); await other.load("share");
  pending.reject(new ReviewApiError("Old session denied", 401)); await assert.rejects(stale);
  assert.ok(other.snapshot("share"));
});
