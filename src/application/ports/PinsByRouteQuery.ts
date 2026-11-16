import type { Pin } from "../../domain/entities/Pin";

export interface PinsByRouteQuery {
  findPinsByCanvasIdAndPageRoute(canvasId: string, pageRoute: string): Promise<readonly Pin[]>;
}
