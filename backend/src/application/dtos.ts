import type { BrowserMetadata } from "../domain/entities/BrowserMetadata";
import type { Canvas } from "../domain/entities/Canvas";
import type { Comment } from "../domain/entities/Comment";
import type { ImageSource } from "../domain/entities/ImageSource";
import type { Pin } from "../domain/entities/Pin";
import type { PinSnapshotMetadata } from "../domain/entities/PinSnapshotMetadata";

export interface GuestReviewerInputDTO {
  readonly reviewerId?: string;
  readonly displayName: string;
  readonly email?: string;
}

export interface CreateCanvasInputDTO {
  readonly imageSource: ImageSource;
  readonly pageUrl: string;
  readonly pageTitle?: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly deviceScaleFactor?: number;
  readonly userAgent?: string;
}

export type CreateCanvasOutputDTO = Canvas;
export type GetCanvasOutputDTO = Canvas;
export type AddPinOutputDTO = Pin;
export type AddCommentOutputDTO = Comment;
export type ReplyToCommentOutputDTO = Comment;
export type ResolvePinOutputDTO = Pin;

export type BrowserMetadataDTO = BrowserMetadata;
export type ImageSourceDTO = ImageSource;
export type PinSnapshotMetadataDTO = PinSnapshotMetadata;
