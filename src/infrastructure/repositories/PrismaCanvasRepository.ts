import type { Prisma } from "@prisma/client";
import type { ICommentRepository, IPinRepository } from "@/domain/repositories";
import {
  createBrowserMetadata,
  createCanvas,
  createComment,
  createGuestReviewer,
  createPin,
  resolvePin,
  type Canvas,
  type ImageSource,
  type Pin,
} from "@/domain";
import { ConcurrentCanvasUpdateError } from "@/application/errors";
import type { CanvasRepository } from "@/application/ports/CanvasRepository";
import { prisma } from "@/infrastructure/database/prisma";

const canvasWithPins = {
  pins: { include: { comments: { orderBy: { createdAt: "asc" as const } } } },
} satisfies Prisma.CanvasInclude;

type PrismaCanvas = Prisma.CanvasGetPayload<{ include: typeof canvasWithPins }>;

export class PrismaCanvasRepository implements CanvasRepository, IPinRepository, ICommentRepository {
  async create(canvas: Canvas): Promise<void> {
    const source = canvas.imageSource;
    await prisma.canvas.create({
      data: {
        id: canvas.id,
        shareId: canvas.shareId,
        title: canvas.browserMetadata.pageTitle || "Sin título",
        sourceType: source.kind === "uploaded-path" ? "image" : "web",
        sourceUrl: canvas.browserMetadata.pageUrl,
        imagePath: source.kind === "uploaded-path" ? source.path : null,
        viewportWidth: Math.round(canvas.browserMetadata.viewportWidth),
        viewportHeight: Math.round(canvas.browserMetadata.viewportHeight),
        deviceScaleFactor: canvas.browserMetadata.deviceScaleFactor,
        userAgent: canvas.browserMetadata.userAgent,
        capturedAt: new Date(canvas.browserMetadata.capturedAt),
        createdAt: new Date(canvas.createdAt),
        updatedAt: new Date(canvas.updatedAt),
        revision: canvas.revision,
      },
    });
  }

  async findById(id: string): Promise<Canvas | null> {
    const record = await prisma.canvas.findUnique({
      where: { id },
      include: canvasWithPins,
    });
    return record ? toDomainCanvas(record) : null;
  }

  async findByShareId(shareId: string): Promise<Canvas | null> {
    const record = await prisma.canvas.findUnique({
      where: { shareId },
      include: canvasWithPins,
    });
    return record ? toDomainCanvas(record) : null;
  }

  async findPinById(pinId: string): Promise<Pin | null> {
    const record = await prisma.pin.findUnique({
      where: { id: pinId },
      include: { comments: { orderBy: { createdAt: "asc" } } },
    });
    return record ? toDomainPin(record) : null;
  }

  async findCommentById(commentId: string) {
    const record = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!record) return null;
    return createComment({
      id: record.id,
      pinId: record.pinId,
      author: createGuestReviewer({ id: record.authorId, displayName: record.authorName }),
      body: record.body,
      createdAt: record.createdAt.toISOString(),
      ...(record.replyToCommentId === null ? {} : { replyToCommentId: record.replyToCommentId }),
    });
  }

  async save(canvas: Canvas, expectedRevision: number): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.canvas.updateMany({
        where: { id: canvas.id, revision: expectedRevision },
        data: { revision: canvas.revision, updatedAt: new Date(canvas.updatedAt) },
      });
      if (updated.count !== 1) {
        throw new ConcurrentCanvasUpdateError(canvas.id);
      }

      await transaction.pin.deleteMany({ where: { canvasId: canvas.id } });
      for (const pin of canvas.pins) {
        await transaction.pin.create({
          data: {
            id: pin.id,
            canvasId: canvas.id,
            x: pin.x,
            y: pin.y,
            status: pin.status,
            createdById: pin.createdBy.id,
            createdByName: pin.createdBy.displayName,
            resolvedById: pin.resolvedBy?.id,
            resolvedByName: pin.resolvedBy?.displayName,
            resolvedAt: pin.resolvedAt ? new Date(pin.resolvedAt) : null,
            createdAt: new Date(pin.createdAt),
            browserWidth: Math.round(pin.snapshot.viewport.width),
            browserHeight: Math.round(pin.snapshot.viewport.height),
            browserName: pin.snapshot.browser.name,
            browserVersion: pin.snapshot.browser.version,
            operatingSystem: pin.snapshot.operatingSystem.name,
            operatingSystemVersion: pin.snapshot.operatingSystem.version,
            reviewedUrl: pin.snapshot.reviewedUrl,
            capturedAt: new Date(pin.createdAt),
            comments: {
              create: pin.comments.map((comment) => ({
                id: comment.id,
                authorId: comment.author.id,
                authorName: comment.author.displayName,
                body: comment.body,
                replyToCommentId: comment.replyToCommentId,
                createdAt: new Date(comment.createdAt),
              })),
            },
          },
        });
      }
    });
  }

  async listSummaries() {
    const records = await prisma.canvas.findMany({
      orderBy: { createdAt: "desc" },
      include: { pins: { select: { status: true } } },
    });
    return records.map((canvas) => ({
      id: canvas.id,
      shareId: canvas.shareId,
      title: canvas.title,
      sourceType: canvas.sourceType === "image" ? "image" as const : "web" as const,
      sourceUrl: canvas.sourceUrl,
      imagePath: canvas.imagePath,
      createdAt: canvas.createdAt.toISOString(),
      pinCount: canvas.pins.length,
      openPinCount: canvas.pins.filter((pin) => pin.status === "open").length,
    }));
  }

  async rememberReviewer(canvasId: string, reviewerId: string, name: string): Promise<void> {
    await prisma.guestReviewer.upsert({
      where: { canvasId_name: { canvasId, name } },
      update: { id: reviewerId },
      create: { id: reviewerId, canvasId, name },
    });
  }
}

function toDomainCanvas(record: PrismaCanvas): Canvas {
  const imageSource: ImageSource = record.sourceType === "image"
    ? { kind: "uploaded-path", path: record.imagePath ?? "" }
    : { kind: "external-url", url: record.sourceUrl ?? "" };
  const base = createCanvas({
    id: record.id,
    shareId: record.shareId,
    imageSource,
    browserMetadata: createBrowserMetadata({
      pageUrl: record.sourceUrl ?? `http://localhost${record.imagePath ?? "/"}`,
      pageTitle: record.title,
      viewportWidth: record.viewportWidth,
      viewportHeight: record.viewportHeight,
      ...(record.deviceScaleFactor === null ? {} : { deviceScaleFactor: record.deviceScaleFactor }),
      ...(record.userAgent === null ? {} : { userAgent: record.userAgent }),
      capturedAt: record.capturedAt.toISOString(),
    }),
    createdAt: record.createdAt.toISOString(),
  });
  return {
    ...base,
    updatedAt: record.updatedAt.toISOString(),
    revision: record.revision,
    pins: record.pins.map(toDomainPin),
  };
}

function toDomainPin(record: PrismaCanvas["pins"][number]): Pin {
  const createdBy = createGuestReviewer({ id: record.createdById, displayName: record.createdByName });
  const pin = createPin({
    id: record.id,
    x: record.x,
    y: record.y,
    createdBy,
    createdAt: record.createdAt.toISOString(),
    snapshot: {
      reviewedUrl: record.reviewedUrl,
      viewport: { width: record.browserWidth, height: record.browserHeight },
      browser: {
        name: record.browserName,
        ...(record.browserVersion === null ? {} : { version: record.browserVersion }),
      },
      operatingSystem: {
        name: record.operatingSystem,
        ...(record.operatingSystemVersion === null ? {} : { version: record.operatingSystemVersion }),
      },
    },
  });
  const comments = record.comments.map((comment) =>
    createComment({
      id: comment.id,
      pinId: record.id,
      author: createGuestReviewer({ id: comment.authorId, displayName: comment.authorName }),
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      ...(comment.replyToCommentId === null ? {} : { replyToCommentId: comment.replyToCommentId }),
    }),
  );
  const withComments: Pin = { ...pin, comments };
  if (record.status === "resolved" && record.resolvedById && record.resolvedByName && record.resolvedAt) {
    return resolvePin(
      withComments,
      createGuestReviewer({ id: record.resolvedById, displayName: record.resolvedByName }),
      record.resolvedAt.toISOString(),
    );
  }
  return withComments;
}
