import { workspaceResponseSchema, canvasListResponseSchema, canvasResponseSchema, createdCanvasResponseSchema, pinResponseSchema, commentResponseSchema, publicConfigSchema } from "@spotcheck/shared";
import type { AddPinRequest, AddCommentRequest, ResolvePinRequest } from "@spotcheck/shared";
import { type ReviewApi, type CreateReviewInput } from "../../domain/ports/ReviewApi";

import { JsonApiClient } from "./JsonApiClient";
export class FetchReviewApi extends JsonApiClient implements ReviewApi {
  async getWorkspace(identifier: string) { return (await this.request(`/api/projects/${encodeURIComponent(identifier)}/workspace`, workspaceResponseSchema)).workspace; }
  async listCanvases() { return (await this.request("/api/canvases", canvasListResponseSchema)).canvases; }
  async getCanvas(shareId: string, pageRoute?: string) {
    const query = pageRoute === undefined ? "" : `?pageRoute=${encodeURIComponent(pageRoute)}`;
    return (await this.request(`/api/canvases/${encodeURIComponent(shareId)}${query}`, canvasResponseSchema)).canvas;
  }
  createCanvas(input: CreateReviewInput) {
    const form = new FormData();
    for (const key of ["sourceType", "title", "viewportWidth", "viewportHeight", "deviceScaleFactor", "userAgent", "url"] as const) {
      const value = input[key];
      if (value !== undefined) form.set(key, String(value));
    }
    if (input.image) form.set("image", input.image);
    return this.request("/api/canvases", createdCanvasResponseSchema, { method: "POST", body: form });
  }
  async addPin(shareId: string, input: AddPinRequest) { return (await this.request(`/api/canvases/${encodeURIComponent(shareId)}/pins`, pinResponseSchema, this.json("POST", input))).pin; }
  async addComment(shareId: string, pinId: string, input: AddCommentRequest) { return (await this.request(`/api/canvases/${encodeURIComponent(shareId)}/pins/${encodeURIComponent(pinId)}/comments`, commentResponseSchema, this.json("POST", input))).comment; }
  async resolvePin(shareId: string, pinId: string, input: ResolvePinRequest) { return (await this.request(`/api/canvases/${encodeURIComponent(shareId)}/pins/${encodeURIComponent(pinId)}`, pinResponseSchema, this.json("PATCH", input))).pin; }
  publicConfig() { return this.request("/api/config", publicConfigSchema); }
  assetUrl(value: string): string {
    const parsed = new URL(value, this.origin);
    if (!/^\/api\/uploads\/[\da-f-]{36}\.(png|jpg)$/.test(parsed.pathname)) throw new Error("Ruta de imagen no válida.");
    return new URL(parsed.pathname, this.origin).href;
  }
}
