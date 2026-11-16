import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AddComment } from "../src/application/use-cases/AddComment";
import { AddPin } from "../src/application/use-cases/AddPin";
import { GetPinsByRoute } from "../src/application/use-cases/GetPinsByRoute";
import { PinNotFoundError } from "../src/application/errors";
import { createBrowserMetadata } from "../src/domain/entities/BrowserMetadata";
import { createCanvas, type Canvas } from "../src/domain/entities/Canvas";
import { createGuestReviewer } from "../src/domain/entities/GuestReviewer";
import { createPin } from "../src/domain/entities/Pin";
import { normalizePageRoute } from "../src/domain/normalizePageRoute";
import { nextPinNumber } from "../src/domain/nextPinNumber";
import type { CanvasRepository } from "../src/application/ports/CanvasRepository";
import type { Clock, IdGenerator } from "../src/application/ports/Runtime";

class MemoryCanvasRepository implements CanvasRepository {
  private current: Canvas;

  constructor(canvas: Canvas) {
    this.current = canvas;
  }

  async create(canvas: Canvas) { this.current = canvas; }
  async findById(id: string) { return this.current.id === id ? this.current : null; }
  async findByShareId(shareId: string) { return this.current.shareId === shareId ? this.current : null; }
  async findMetadataByShareId(shareId: string) {
    return this.current.shareId === shareId ? { ...this.current, pins: [] } : null;
  }
  async findPinsByCanvasIdAndPageRoute(canvasId: string, pageRoute: string) {
    if (this.current.id !== canvasId) return [];
    return this.current.pins.filter((pin) => pin.pageRoute === pageRoute);
  }
  async save(canvas: Canvas, expectedRevision: number) {
    if (this.current.revision !== expectedRevision) throw new Error("revision conflict");
    this.current = canvas;
  }
  read() { return this.current; }
}

class TestIds implements IdGenerator {
  private sequence = 0;
  next(prefix: string) { this.sequence += 1; return `${prefix}-${this.sequence}`; }
}

const clock: Clock = { now: () => "2026-01-02T03:04:05.000Z" };

function makeCanvas() {
  return createCanvas({
    id: "canvas-1",
    shareId: "share-1",
    imageSource: { kind: "external-url", url: "https://example.test/home" },
    browserMetadata: createBrowserMetadata({
      pageUrl: "https://example.test/home",
      pageTitle: "Example",
      viewportWidth: 1200,
      viewportHeight: 800,
      capturedAt: "2026-01-02T03:04:05.000Z",
    }),
    createdAt: "2026-01-02T03:04:05.000Z",
  });
}

function snapshot(reviewedUrl: string) {
  return {
    reviewedUrl,
    viewport: { width: 1200, height: 800 },
    browser: { name: "Test browser" },
    operatingSystem: { name: "Test OS" },
  };
}

describe("page route and canvas-wide pin numbering", () => {
  it("normalizes absolute URLs and paths without query/hash or redundant slashes", () => {
    assert.equal(normalizePageRoute("https://site.test//docs///intro/?q=1#top"), "/docs/intro");
    assert.equal(normalizePageRoute("/docs///intro/?q=1#top"), "/docs/intro");
    assert.equal(normalizePageRoute("https://site.test/?q=1"), "/");
    assert.equal(normalizePageRoute("https://site.test/a/../b"), "/a/../b");
  });

  it("validates optional DOM anchors and accepts inclusive fractional boundaries", () => {
    const common = {
      id: "pin-anchor",
      pageRoute: "/one",
      pinNumber: 1,
      x: 0.5,
      y: 0.5,
      createdBy: createGuestReviewer({ id: "reviewer", displayName: "Reviewer" }),
      createdAt: "2026-01-02T03:04:05.000Z",
      snapshot: snapshot("https://example.test/one"),
    };
    const anchored = createPin({
      ...common,
      domAnchor: { selector: "main > article", offsetX: 0, offsetY: 1 },
    });
    assert.deepEqual(anchored.domAnchor, { selector: "main > article", offsetX: 0, offsetY: 1 });
    assert.equal(createPin({
      ...common,
      domAnchor: { selector: "a".repeat(1200), offsetX: 0.5, offsetY: 0.5 },
    }).domAnchor?.selector.length, 1200);
    assert.equal(createPin(common).domAnchor, undefined);
    assert.deepEqual(createPin({
      ...common,
      snapshot: { ...snapshot("https://example.test/one"), scrollOffset: { x: 0, y: 120 } },
    }).snapshot.scrollOffset, { x: 0, y: 120 });
    assert.throws(() => createPin({
      ...common,
      snapshot: { ...snapshot("https://example.test/one"), scrollOffset: { x: 0, y: Number.POSITIVE_INFINITY } },
    }), { code: "INVALID_VALUE" });
    for (const anchor of [
      { selector: " ", offsetX: 0.5, offsetY: 0.5 },
      { selector: "a".repeat(1201), offsetX: 0.5, offsetY: 0.5 },
      { selector: "main", offsetX: -0.01, offsetY: 0.5 },
      { selector: "main", offsetX: 0.5, offsetY: Number.POSITIVE_INFINITY },
    ]) {
      assert.throws(() => createPin({ ...common, domAnchor: anchor }), { code: "INVALID_VALUE" });
    }
  });

  it("numbers pins globally and returns only matching-route comments after persistence", async () => {
    const repository = new MemoryCanvasRepository(makeCanvas());
    const ids = new TestIds();
    const addPin = new AddPin(repository, ids, clock);
    const common = {
      canvasId: "canvas-1",
      x: 0.5,
      y: 0.5,
      author: { displayName: "Reviewer" },
    };
    const first = await addPin.execute({
      ...common,
      pageRoute: "/one",
      snapshot: snapshot("https://example.test/one?campaign=1"),
    });
    const second = await addPin.execute({
      ...common,
      pageRoute: "/two",
      snapshot: snapshot("https://example.test/two#section"),
    });

    assert.equal(first.pinNumber, 1);
    assert.equal(second.pinNumber, 2);
    assert.equal(second.snapshot.reviewedUrl, "https://example.test/two#section");
    assert.equal(nextPinNumber(repository.read().pins), 3);

    const addComment = new AddComment(repository, ids, clock);
    await addComment.execute({
      canvasId: "canvas-1",
      pinId: second.id,
      pageRoute: "/two/",
      author: { displayName: "Commenter" },
      body: "Route-specific feedback",
    });
    await assert.rejects(
      addComment.execute({
        canvasId: "canvas-1",
        pinId: second.id,
        pageRoute: "/one",
        author: { displayName: "Commenter" },
        body: "Wrong page",
      }),
      PinNotFoundError,
    );

    const route = await new GetPinsByRoute(repository, repository).execute({
      shareId: "share-1",
      pageRoute: "/two/?q=ignored",
    });
    assert.deepEqual(route.pins.map((pin) => pin.id), [second.id]);
    assert.equal(route.pins[0].comments[0].body, "Route-specific feedback");
    assert.equal(repository.read().pins.length, 2);
  });
});
