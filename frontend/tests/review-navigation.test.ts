import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectWorkspace } from "@spotcheck/shared";
import { selectWorkspaceRoute, detectedWorkspaceRoute, transitionDetectedLocation } from "../src/application/workspaceNavigation";
import { inspectorRouteHref, proxyFrameUrl } from "../src/presentation/reviewProxy";
const at = "2026-11-16T12:00:00.000Z";
const workspace: ProjectWorkspace = { project: { id: "p", shareId: "s", imageSource: { kind: "external-url", url: "https://site.test/home" }, browserMetadata: { pageUrl: "https://site.test/home", pageTitle: "Site", viewportWidth: 100, viewportHeight: 100, capturedAt: at }, createdAt: at, updatedAt: at, revision: 0, pins: [] }, siteUrl: "https://site.test/home", routes: [{ path: "/products", pinCount: 2, openPinCount: 1 }] };
test("route selector only accepts routes with pins on the permanent base site", () => {
  assert.deepEqual(selectWorkspaceRoute(workspace, "/products"), { href: "https://site.test/products", pageRoute: "/products" });
  for (const route of ["/unknown", "https://evil.test/products", "//evil.test/products", "javascript:alert(1)"]) assert.throws(() => selectWorkspaceRoute(workspace, route));
  assert.deepEqual(detectedWorkspaceRoute(workspace, "https://site.test/new?tab=1#section"), { href: "https://site.test/new?tab=1#section", pageRoute: "/new" });
  assert.throws(() => detectedWorkspaceRoute(workspace, "https://evil.test/products"));
  assert.throws(() => detectedWorkspaceRoute(workspace, "https://user:secret@site.test/products"));
});

test("an external inspector href reaches navigation recovery and remounts the permanent-site frame", () => {
  const current = { href: "https://site.test/products", pageRoute: "/products", frameUrl: "https://site.test/products", frameRevision: 3 };
  const external = proxyFrameUrl("https://external.test/escape", "http://localhost:3002");
  const forwarded = inspectorRouteHref(external, "http://localhost:3002");
  assert.equal(forwarded, "https://external.test/escape");
  const result = transitionDetectedLocation(workspace, current, forwarded);
  assert.ok(result.error);
  assert.deepEqual(result.location, { href: workspace.siteUrl, pageRoute: "/home", frameUrl: workspace.siteUrl, frameRevision: 4 });
  const malformedProxy = inspectorRouteHref("http://localhost:3002/not-a-document", "http://localhost:3002");
  assert.equal(transitionDetectedLocation(workspace, current, malformedProxy).location.frameUrl, workspace.siteUrl);
  const allowed = transitionDetectedLocation(workspace, current, "https://site.test/another");
  assert.equal(allowed.error, null); assert.equal(allowed.location.pageRoute, "/another"); assert.equal(allowed.location.frameRevision, 3);
});
