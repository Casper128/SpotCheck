import type { Canvas } from "../entities/Canvas";

export interface ICanvasRepository {
  create(canvas: Canvas): Promise<void>;
  findById(id: string): Promise<Canvas | null>;
  findByShareId(shareId: string): Promise<Canvas | null>;
  findMetadataByShareId(shareId: string): Promise<Canvas | null>;
  save(canvas: Canvas, expectedRevision: number): Promise<void>;
}
