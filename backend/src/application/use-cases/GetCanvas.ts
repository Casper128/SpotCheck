import type { Canvas } from "../../domain/entities/Canvas";
import { CanvasNotFoundError } from "../errors";
import type { GetCanvasOutputDTO } from "../dtos";
import type { CanvasRepository } from "../ports/CanvasRepository";

export type GetCanvasInputDTO =
  | { readonly canvasId: string }
  | { readonly shareId: string };

export class GetCanvas {
  constructor(private readonly canvases: CanvasRepository) {}

  async execute(input: GetCanvasInputDTO): Promise<GetCanvasOutputDTO> {
    const canvas: Canvas | null = "canvasId" in input
      ? await this.canvases.findById(input.canvasId)
      : await this.canvases.findByShareId(input.shareId);

    if (!canvas) {
      throw new CanvasNotFoundError("canvasId" in input ? input.canvasId : input.shareId);
    }
    return canvas;
  }
}
