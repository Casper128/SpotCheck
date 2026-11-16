import { assertNonBlank, assertTimestamp, DomainError } from "../errors";
import type { GuestReviewer } from "./GuestReviewer";

export interface Comment {
  readonly id: string;
  readonly pinId: string;
  readonly author: GuestReviewer;
  readonly body: string;
  readonly createdAt: string;
  readonly replyToCommentId?: string;
}

export interface CommentAttributes {
  readonly id: string;
  readonly pinId: string;
  readonly author: GuestReviewer;
  readonly body: string;
  readonly createdAt: string;
  readonly replyToCommentId?: string;
}

export function createComment(attributes: CommentAttributes): Comment {
  const id = assertNonBlank(attributes.id, "comment.id");
  const pinId = assertNonBlank(attributes.pinId, "comment.pinId");
  const body = assertNonBlank(attributes.body, "comment.body");
  if (body.length > 5000) {
    throw new DomainError("body must be at most 5000 characters.", "INVALID_VALUE", "comment.body");
  }
  assertTimestamp(attributes.createdAt, "comment.createdAt");
  const replyToCommentId = attributes.replyToCommentId
    ? assertNonBlank(attributes.replyToCommentId, "comment.replyToCommentId")
    : undefined;

  return {
    id,
    pinId,
    author: attributes.author,
    body,
    createdAt: attributes.createdAt,
    ...(replyToCommentId ? { replyToCommentId } : {}),
  };
}
