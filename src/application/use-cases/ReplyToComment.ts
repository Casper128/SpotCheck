import { addCommentToPin } from "../../domain/entities/Canvas";
import { createComment } from "../../domain/entities/Comment";
import type { Comment } from "../../domain/entities/Comment";
import { CanvasNotFoundError } from "../errors";
import type { ReplyToCommentOutputDTO, GuestReviewerInputDTO } from "../dtos";
import type { CanvasRepository } from "../ports/CanvasRepository";
import type { Clock, IdGenerator } from "../ports/Runtime";
import { resolveReviewer } from "../reviewerInput";
import { normalizePageRoute } from "../../domain/normalizePageRoute";
import { PinNotFoundError } from "../errors";

export interface ReplyToCommentInputDTO {
  readonly canvasId: string;
  readonly pinId: string;
  readonly pageRoute: string;
  readonly commentId: string;
  readonly author: GuestReviewerInputDTO;
  readonly body: string;
}

export class ReplyToComment {
  constructor(
    private readonly canvases: CanvasRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReplyToCommentInputDTO): Promise<ReplyToCommentOutputDTO> {
    const canvas = await this.canvases.findById(input.canvasId);
    if (!canvas) {
      throw new CanvasNotFoundError(input.canvasId);
    }
    if (!canvas.pins.some((pin) => pin.id === input.pinId && pin.pageRoute === normalizePageRoute(input.pageRoute))) {
      throw new PinNotFoundError(input.pinId);
    }

    const createdAt = this.clock.now();
    const reply: Comment = createComment({
      id: this.ids.next("comment"),
      pinId: input.pinId,
      author: resolveReviewer(input.author, this.ids),
      body: input.body,
      createdAt,
      replyToCommentId: input.commentId,
    });
    const updatedCanvas = addCommentToPin(canvas, input.pinId, reply, createdAt);
    await this.canvases.save(updatedCanvas, canvas.revision);
    return reply;
  }
}
