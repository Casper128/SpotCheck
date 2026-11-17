import type { AddPinRequest, AddCommentRequest, ResolvePinRequest, Canvas, CanvasSummary, CreatedCanvasResponse, Pin, Comment, PublicConfig, CreateCanvasFields } from "@spotcheck/shared";

export type CreateReviewInput = CreateCanvasFields & { readonly image?: File };
export interface ReviewApi {
  listCanvases(): Promise<readonly CanvasSummary[]>;
  getCanvas(shareId: string, pageRoute?: string): Promise<Canvas>;
  createCanvas(input: CreateReviewInput): Promise<CreatedCanvasResponse>;
  addPin(shareId: string, input: AddPinRequest): Promise<Pin>;
  addComment(shareId: string, pinId: string, input: AddCommentRequest): Promise<Comment>;
  resolvePin(shareId: string, pinId: string, input: ResolvePinRequest): Promise<Pin>;
  publicConfig(): Promise<PublicConfig>;
  assetUrl(path: string): string;
}
export class ReviewApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = "ReviewApiError"; }
}
