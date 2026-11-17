import type { CanvasSummary } from "@spotcheck/shared";
import type { CanvasRepository } from "./CanvasRepository";
import type { PinsByRouteQuery } from "./PinsByRouteQuery";

export interface ReviewRepository extends CanvasRepository, PinsByRouteQuery {
  listSummaries(): Promise<readonly CanvasSummary[]>;
  rememberReviewer(canvasId: string, reviewerId: string, name: string): Promise<void>;
}
