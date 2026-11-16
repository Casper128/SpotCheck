import { assertNonBlank, assertTimestamp, DomainError } from "../errors";
import type { BrowserMetadata } from "./BrowserMetadata";
import type { Comment } from "./Comment";
import type { GuestReviewer } from "./GuestReviewer";
import { createImageSource, type ImageSource } from "./ImageSource";
import type { Pin } from "./Pin";
import { resolvePin as resolvePinEntity } from "./Pin";

export interface Canvas {
  readonly id: string;
  readonly shareId: string;
  readonly imageSource: ImageSource;
  readonly browserMetadata: BrowserMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly pins: readonly Pin[];
}

export interface CanvasAttributes {
  readonly id: string;
  readonly shareId: string;
  readonly imageSource: ImageSource;
  readonly browserMetadata: BrowserMetadata;
  readonly createdAt: string;
}

export function createCanvas(attributes: CanvasAttributes): Canvas {
  const id = assertNonBlank(attributes.id, "canvas.id");
  const shareId = assertNonBlank(attributes.shareId, "canvas.shareId");
  assertTimestamp(attributes.createdAt, "canvas.createdAt");
  return {
    id,
    shareId,
    imageSource: createImageSource(attributes.imageSource),
    browserMetadata: attributes.browserMetadata,
    createdAt: attributes.createdAt,
    updatedAt: attributes.createdAt,
    revision: 0,
    pins: [],
  };
}

export function addPinToCanvas(canvas: Canvas, pin: Pin, updatedAt: string): Canvas {
  if (canvas.pins.some((existing) => existing.id === pin.id)) {
    throw new DomainError("A pin with this id already exists on the canvas.", "DUPLICATE_ID", "pin.id");
  }
  if (Date.parse(pin.createdAt) < Date.parse(canvas.createdAt)) {
    throw new DomainError("pin.createdAt cannot precede canvas.createdAt.", "INVALID_VALUE", "pin.createdAt");
  }
  return reviseCanvas(canvas, updatedAt, { pins: [...canvas.pins, pin] });
}

export function addCommentToPin(canvas: Canvas, pinId: string, comment: Comment, updatedAt: string): Canvas {
  const pinIndex = canvas.pins.findIndex((pin) => pin.id === pinId);
  if (pinIndex < 0) {
    throw new DomainError("Pin was not found on the canvas.", "NOT_FOUND", "pinId");
  }
  const pin = canvas.pins[pinIndex];
  if (pin.status === "resolved") {
    throw new DomainError("Cannot add a comment to a resolved pin.", "INVALID_STATE", "pin.status");
  }
  if (comment.pinId !== pinId) {
    throw new DomainError("Comment pinId must match the target pin.", "INVALID_VALUE", "comment.pinId");
  }
  if (canvas.pins.some((entry) => entry.comments.some((existing) => existing.id === comment.id))) {
    throw new DomainError("A comment with this id already exists on the canvas.", "DUPLICATE_ID", "comment.id");
  }
  if (
    comment.replyToCommentId !== undefined &&
    !pin.comments.some((existing) => existing.id === comment.replyToCommentId)
  ) {
    throw new DomainError("Reply target was not found on this pin.", "NOT_FOUND", "comment.replyToCommentId");
  }

  const updatedPin: Pin = { ...pin, comments: [...pin.comments, comment] };
  return reviseCanvas(canvas, updatedAt, {
    pins: canvas.pins.map((entry, index) => (index === pinIndex ? updatedPin : entry)),
  });
}

export function resolveCanvasPin(
  canvas: Canvas,
  pinId: string,
  reviewer: GuestReviewer,
  resolvedAt: string,
): Canvas {
  const pinIndex = canvas.pins.findIndex((pin) => pin.id === pinId);
  if (pinIndex < 0) {
    throw new DomainError("Pin was not found on the canvas.", "NOT_FOUND", "pinId");
  }
  const pin = resolvePinEntity(canvas.pins[pinIndex], reviewer, resolvedAt);
  return reviseCanvas(canvas, resolvedAt, {
    pins: canvas.pins.map((entry, index) => (index === pinIndex ? pin : entry)),
  });
}

function reviseCanvas(canvas: Canvas, updatedAt: string, changes: Pick<Canvas, "pins">): Canvas {
  assertTimestamp(updatedAt, "canvas.updatedAt");
  if (Date.parse(updatedAt) < Date.parse(canvas.updatedAt)) {
    throw new DomainError("updatedAt cannot move backwards.", "INVALID_VALUE", "canvas.updatedAt");
  }
  return { ...canvas, ...changes, updatedAt, revision: canvas.revision + 1 };
}
