import { addPinToCanvas } from "../../domain/entities/Canvas";
import { DomainError } from "../../domain/errors";
import { createPin } from "../../domain/entities/Pin";
import type { DOMAnchor, Pin } from "../../domain/entities/Pin";
import type { PinSnapshotMetadata } from "../../domain/entities/PinSnapshotMetadata";
import { CanvasNotFoundError } from "../errors";
import type { AddPinOutputDTO, GuestReviewerInputDTO } from "../dtos";
import type { CanvasRepository } from "../ports/CanvasRepository";
import type { Clock, IdGenerator } from "../ports/Runtime";
import { resolveReviewer } from "../reviewerInput";
import { normalizePageRoute } from "../../domain/normalizePageRoute";
import { nextPinNumber } from "../../domain/nextPinNumber";

export interface AddPinInputDTO {
  readonly canvasId: string;
  readonly x: number;
  readonly y: number;
  readonly pageRoute: string;
  readonly domAnchor?: DOMAnchor;
  readonly snapshot: PinSnapshotMetadata;
  readonly author: GuestReviewerInputDTO;
}

export class AddPin {
  constructor(
    private readonly canvases: CanvasRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: AddPinInputDTO): Promise<AddPinOutputDTO> {
    const canvas = await this.canvases.findById(input.canvasId);
    if (!canvas) {
      throw new CanvasNotFoundError(input.canvasId);
    }

    const createdAt = this.clock.now();
    if (normalizePageRoute(input.snapshot.reviewedUrl) !== normalizePageRoute(input.pageRoute)) {
      throw new DomainError("pageRoute must match the reviewedUrl path.", "INVALID_VALUE", "pageRoute");
    }
    const pin: Pin = createPin({
      id: this.ids.next("pin"),
      pageRoute: normalizePageRoute(input.pageRoute),
      pinNumber: nextPinNumber(canvas.pins),
      x: input.x,
      y: input.y,
      ...(input.domAnchor ? { domAnchor: input.domAnchor } : {}),
      snapshot: input.snapshot,
      createdBy: resolveReviewer(input.author, this.ids),
      createdAt,
    });
    const updatedCanvas = addPinToCanvas(canvas, pin, createdAt);
    await this.canvases.save(updatedCanvas, canvas.revision);
    return pin;
  }
}
