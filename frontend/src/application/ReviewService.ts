import type { ReviewApi, CreateReviewInput } from "../domain/ports/ReviewApi";
import type { AddPinRequest, AddCommentRequest, ResolvePinRequest } from "@spotcheck/shared";

export class ReviewService {
  constructor(private readonly api: ReviewApi) {}
  listCanvases() { return this.api.listCanvases(); }
  async loadReview(shareId: string, pageRoute?: string) {
    const canvas = await this.api.getCanvas(shareId, pageRoute);
    // Old uploaded-image metadata may point to the former monolith origin.
    return canvas.imageSource.kind === "uploaded-path"
      ? { ...canvas, browserMetadata: { ...canvas.browserMetadata, pageUrl: this.api.assetUrl(canvas.imageSource.path) } }
      : canvas;
  }
  createReview(input: CreateReviewInput) { return this.api.createCanvas(input); }
  addPin(shareId: string, input: AddPinRequest) { return this.api.addPin(shareId, input); }
  addComment(shareId: string, pinId: string, input: AddCommentRequest) { return this.api.addComment(shareId, pinId, input); }
  resolvePin(shareId: string, pinId: string, input: ResolvePinRequest) { return this.api.resolvePin(shareId, pinId, input); }
  publicConfig() { return this.api.publicConfig(); }
  imageUrl(path: string) { return this.api.assetUrl(path); }
}
