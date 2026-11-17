import { resolveCanvasPin } from "../../domain/entities/Canvas";
import { CanvasNotFoundError } from "../errors";
import type { GuestReviewerInputDTO, ResolvePinOutputDTO } from "../dtos";
import type { CanvasRepository } from "../ports/CanvasRepository";
import type { Clock, IdGenerator } from "../ports/Runtime";
import { resolveReviewer } from "../reviewerInput";
import { belongsToProjectSite } from "../../domain/projectSite";
import { normalizePageRoute } from "../../domain/normalizePageRoute";
import { PinNotFoundError } from "../errors";

export interface ResolvePinInputDTO {
  readonly canvasId: string;
  readonly pinId: string;
  readonly pageRoute: string;
  readonly resolvedBy: GuestReviewerInputDTO;
}

export class ResolvePin {
  constructor(
    private readonly canvases: CanvasRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ResolvePinInputDTO): Promise<ResolvePinOutputDTO> {
    const canvas = await this.canvases.findById(input.canvasId);
    if (!canvas) {
      throw new CanvasNotFoundError(input.canvasId);
    }
    if (!canvas.pins.some((pin) => pin.id === input.pinId && pin.pageRoute === normalizePageRoute(input.pageRoute) && belongsToProjectSite(canvas, pin.snapshot.reviewedUrl))) {
      throw new PinNotFoundError(input.pinId);
    }

    const resolvedAt = this.clock.now();
    const reviewer = resolveReviewer(input.resolvedBy, this.ids);
    const updatedCanvas = resolveCanvasPin(canvas, input.pinId, reviewer, resolvedAt);
    await this.canvases.save(updatedCanvas, canvas.revision);
    return updatedCanvas.pins.find((pin) => pin.id === input.pinId)!;
  }
}
