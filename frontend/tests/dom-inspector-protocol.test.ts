import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getInspectorPlacementAction,
  isInspectorMessage,
  isTrustedInspectorEvent,
  normalizeViewportPoint,
} from "../src/presentation/domInspectorProtocol";

describe("DOM inspector message validation", () => {
  const nonce = "c57b15fa-6015-49f7-9c16-2429dd3b245f";
  const origin = "https://reviewed.example";
  const source = {} as MessageEventSource;
  const ready = {
    protocol: "spotcheck-dom",
    version: 2,
    nonce,
    type: "ready",
    href: `${origin}/page`,
    parentOrigin: "https://spotcheck.example",
  };
  const parentOrigin = "https://spotcheck.example";

  it("accepts only the expected iframe source, exact origin, and current nonce", () => {
    const event = { source, origin, data: ready };
    assert.equal(isTrustedInspectorEvent(event, source, origin, nonce, parentOrigin), true);
    assert.equal(isTrustedInspectorEvent({ ...event, source: {} as MessageEventSource }, source, origin, nonce, parentOrigin), false);
    assert.equal(isTrustedInspectorEvent({ ...event, origin: "null" }, source, origin, nonce, parentOrigin), false);
    assert.equal(isTrustedInspectorEvent({ ...event, origin: "https://spoof.example" }, source, origin, nonce, parentOrigin), false);
    assert.equal(isTrustedInspectorEvent({
      ...event,
      data: { ...ready, nonce: "expired-session-nonce" },
    }, source, origin, nonce, parentOrigin), false);
    assert.equal(isTrustedInspectorEvent({
      ...event,
      data: { ...ready, parentOrigin: "https://other.example" },
    }, source, origin, nonce, parentOrigin), false);
  });

  it("rejects malformed, oversized, and out-of-bounds anchor messages", () => {
    assert.equal(isInspectorMessage(ready, nonce), true);
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "route",
      href: `${origin}/products?tab=overview#features`,
    }, nonce), true);
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "route",
      href: "javascript:alert(1)",
    }, nonce), false);
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "selected",
      mode: "element",
      href: `${origin}/page`,
      anchor: { selector: "#target", offsetX: 0.25, offsetY: 0.75 },
      pointX: 200, pointY: 300, viewportWidth: 400, viewportHeight: 600,
      scrollX: 0, scrollY: 0,
    }, nonce), true);
    assert.deepEqual(normalizeViewportPoint(200, 300, 400, 600), { x: 0.5, y: 0.5 });
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "selected",
      mode: "element",
      href: `${origin}/page`,
      anchor: { selector: "#target", offsetX: 0.25, offsetY: 0.75 },
      pointX: 401, pointY: 300, viewportWidth: 400, viewportHeight: 600,
      scrollX: 0, scrollY: 0,
    }, nonce), false);
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "selected",
      mode: "element",
      href: `${origin}/page`,
      anchor: { selector: " ", offsetX: 0.5, offsetY: 0.5 },
      pointX: 10, pointY: 10, viewportWidth: 100, viewportHeight: 100,
      scrollX: 0, scrollY: 0,
    }, nonce), false);
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "selected",
      mode: "element",
      href: `${origin}/page`,
      anchor: { selector: "main", offsetX: 1.1, offsetY: 0.5 },
      pointX: 10, pointY: 10, viewportWidth: 100, viewportHeight: 100,
      scrollX: 0, scrollY: 0,
    }, nonce), false);
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "hover",
      mode: "element",
      candidates: [{ selector: "a".repeat(1201), label: "a", rect: { left: 0, top: 0, width: 10, height: 10 } }],
      selectedSelector: "a".repeat(1201),
    }, nonce), false);
    assert.equal(isInspectorMessage({
      protocol: "spotcheck-dom", version: 2, nonce, type: "positions",
      positions: [{
        id: "pin-1",
        rect: { left: 12, top: -50, width: 40, height: 30 },
        viewportWidth: 400,
        viewportHeight: 600,
      }],
      missing: [],
      viewportWidth: 400,
      viewportHeight: 600,
      scrollX: 0,
      scrollY: 150,
    }, nonce), true);
    assert.deepEqual(normalizeViewportPoint(100, -50, 400, 600), { x: 0.25, y: -1 / 12 });
  });

  it("keeps element/container selection and free-point placement mutually exclusive", () => {
    const elementSelection = {
      protocol: "spotcheck-dom",
      version: 2,
      nonce,
      type: "selected",
      mode: "element",
      href: `${origin}/page`,
      anchor: { selector: "#target", offsetX: 0.25, offsetY: 0.75 },
      pointX: 20,
      pointY: 30,
      viewportWidth: 400,
      viewportHeight: 600,
      scrollX: 0,
      scrollY: 100,
    } as const;
    const freePoint = {
      protocol: "spotcheck-dom",
      version: 2,
      nonce,
      type: "point",
      href: `${origin}/page`,
      pointX: 20,
      pointY: 30,
      viewportWidth: 400,
      viewportHeight: 600,
      scrollX: 0,
      scrollY: 100,
    } as const;

    assert.equal(isInspectorMessage(elementSelection, nonce), true);
    assert.equal(isInspectorMessage(freePoint, nonce), true);
    assert.equal(getInspectorPlacementAction(elementSelection, "element")?.type, "anchor");
    assert.equal(getInspectorPlacementAction(elementSelection, "container"), null);
    assert.equal(getInspectorPlacementAction(elementSelection, "free"), null);
    assert.equal(getInspectorPlacementAction(freePoint, "free")?.type, "point");
    assert.equal(getInspectorPlacementAction(freePoint, "element"), null);
    assert.equal(getInspectorPlacementAction(freePoint, "container"), null);
    assert.equal(isInspectorMessage({ ...freePoint, anchor: { selector: "body", offsetX: 0.5, offsetY: 0.5 } }, nonce), false);
  });

  it("accepts nearby container candidates without preferring the largest wrapper", () => {
    const hover = {
      protocol: "spotcheck-dom",
      version: 2,
      nonce,
      type: "hover",
      mode: "container",
      candidates: [
        { selector: "#inner", label: "div#inner", rect: { left: 10, top: 10, width: 200, height: 80 } },
        { selector: "main", label: "main", rect: { left: 0, top: 0, width: 900, height: 700 } },
      ],
      selectedSelector: "#inner",
    };
    assert.equal(isInspectorMessage(hover, nonce), true);
    assert.equal(isInspectorMessage({
      ...hover,
      mode: "element",
      selectedSelector: "main",
    }, nonce), false);
  });
});
