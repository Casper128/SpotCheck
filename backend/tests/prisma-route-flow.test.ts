import assert from "node:assert/strict";
import { readdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { AddComment } from "../src/application/use-cases/AddComment";
import { AddPin } from "../src/application/use-cases/AddPin";
import { GetPinsByRoute } from "../src/application/use-cases/GetPinsByRoute";
import type { Clock, IdGenerator, IdKind } from "../src/application/ports/Runtime";
import { PrismaCanvasRepository } from "../src/infrastructure/repositories/PrismaCanvasRepository";

class SequenceIds implements IdGenerator {
  private sequence = 0;
  next(kind: IdKind) {
    this.sequence += 1;
    return `${kind}-${this.sequence}`;
  }
}

describe("SQLite route migration and persisted application flow", () => {
  it("backfills existing rows and keeps comments through route-scoped writes", async () => {
    const databasePath = join(process.cwd(), "prisma", `.spotcheck-route-flow-${process.pid}.db`);
    const database = new PrismaClient({
      datasources: { db: { url: `file:${databasePath}` } },
    });
    try {
      await database.$connect();
      const migrationsRoot = join(process.cwd(), "prisma", "migrations");
      const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migrationName of migrations.slice(0, 2)) {
        const sql = await readFile(join(migrationsRoot, migrationName, "migration.sql"), "utf8");
        for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
          await database.$executeRawUnsafe(statement);
        }
      }

      const timestamp = new Date("2026-01-01T00:00:00.000Z");
      await database.canvas.create({
        select: { id: true },
        data: {
          id: "canvas-existing",
          shareId: "share-existing",
          title: "Existing canvas",
          sourceType: "web",
          sourceUrl: "https://example.test/home",
          viewportWidth: 1200,
          viewportHeight: 800,
          capturedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 0,
        },
      });
      await database.$executeRaw`
        INSERT INTO "Pin" (
          "id", "canvasId", "x", "y", "status", "createdById", "createdByName",
          "createdAt", "browserWidth", "browserHeight", "browserName", "operatingSystem",
          "reviewedUrl", "capturedAt"
        ) VALUES
          ('pin-old-b', 'canvas-existing', 0.4, 0.4, 'open', 'reviewer', 'Reviewer',
           '2026-01-02T00:00:00.000Z', 1200, 800, 'Browser', 'OS',
           'https://example.test/other/', '2026-01-02T00:00:00.000Z'),
          ('pin-old-a', 'canvas-existing', 0.3, 0.3, 'open', 'reviewer', 'Reviewer',
           '2026-01-01T00:00:00.000Z', 1200, 800, 'Browser', 'OS',
           'https://example.test//home/?campaign=old#top', '2026-01-01T00:00:00.000Z')
      `;
      await database.$executeRaw`
        INSERT INTO "Comment" ("id", "pinId", "authorId", "authorName", "body", "createdAt")
        VALUES ('comment-old', 'pin-old-a', 'reviewer', 'Reviewer', 'Preserve me', '2026-01-01T00:00:00.000Z')
      `;

      for (const migrationName of migrations.slice(2)) {
        const migration = await readFile(join(migrationsRoot, migrationName, "migration.sql"), "utf8");
        for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
          await database.$executeRawUnsafe(statement);
        }
      }

      const repository = new PrismaCanvasRepository(database);
      const original = await repository.findByShareId("share-existing");
      assert.deepEqual(
        original?.pins.map(({ id, pageRoute, pinNumber }) => ({ id, pageRoute, pinNumber })),
        [
          { id: "pin-old-a", pageRoute: "/home", pinNumber: 1 },
          { id: "pin-old-b", pageRoute: "/other", pinNumber: 2 },
        ],
      );
      assert.equal(original?.pins[0].comments[0].body, "Preserve me");
      assert.equal(original?.pins[0].domAnchor, undefined);
      assert.equal(original?.pins[0].snapshot.scrollOffset, undefined);

      const clock: Clock = { now: () => "2026-01-03T00:00:00.000Z" };
      const addPin = new AddPin(repository, new SequenceIds(), clock);
      const added = await addPin.execute({
        canvasId: "canvas-existing",
        x: 0.6,
        y: 0.6,
        pageRoute: "/new",
        domAnchor: { selector: "#review-target", offsetX: 0.25, offsetY: 0.75 },
        author: { displayName: "Reviewer" },
        snapshot: {
          reviewedUrl: "https://example.test/new?campaign=next",
          viewport: { width: 1200, height: 800 },
          scrollOffset: { x: 8, y: 120 },
          browser: { name: "Browser" },
          operatingSystem: { name: "OS" },
        },
      });
      assert.equal(added.pinNumber, 3);
      const freePoint = await addPin.execute({
        canvasId: "canvas-existing",
        x: 0.2,
        y: 0.3,
        pageRoute: "/free",
        author: { displayName: "Reviewer" },
        snapshot: {
          reviewedUrl: "https://example.test/free",
          viewport: { width: 900, height: 600 },
          scrollOffset: { x: 0, y: 240 },
          browser: { name: "Browser" },
          operatingSystem: { name: "OS" },
        },
      });
      assert.equal(freePoint.pinNumber, 4);
      assert.equal(freePoint.domAnchor, undefined);

      const addComment = new AddComment(repository, new SequenceIds(), clock);
      await addComment.execute({
        canvasId: "canvas-existing",
        pinId: added.id,
        pageRoute: "/new/",
        author: { displayName: "Commenter" },
        body: "Persisted on this route",
      });
      const route = await new GetPinsByRoute(repository, repository).execute({
        shareId: "share-existing",
        pageRoute: "https://example.test/new?ignored=yes",
      });
      assert.deepEqual(route.pins.map((pin) => pin.pinNumber), [3]);
      assert.equal(route.pins[0].snapshot.reviewedUrl, "https://example.test/new?campaign=next");
      assert.deepEqual(route.pins[0].domAnchor, { selector: "#review-target", offsetX: 0.25, offsetY: 0.75 });

      const reloaded = await repository.findByShareId("share-existing");
      assert.equal(reloaded?.pins.length, 4);
      assert.equal(reloaded?.pins[0].comments[0].body, "Preserve me");
      assert.equal(reloaded?.pins[2].comments[0].body, "Persisted on this route");
      assert.deepEqual(reloaded?.pins[2].domAnchor, { selector: "#review-target", offsetX: 0.25, offsetY: 0.75 });
      assert.deepEqual(reloaded?.pins[2].snapshot.scrollOffset, { x: 8, y: 120 });
      assert.equal(reloaded?.pins[3].domAnchor, undefined);
      assert.deepEqual(reloaded?.pins[3].snapshot.scrollOffset, { x: 0, y: 240 });
    } finally {
      await database.$disconnect();
      await unlink(databasePath).catch((error: unknown) => {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
        throw error;
      });
    }
  });
});
