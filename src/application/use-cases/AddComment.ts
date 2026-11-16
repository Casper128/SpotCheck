import { addCommentToPin } from "../../domain/entities/Canvas";
import { createComment } from "../../domain/entities/Comment";
import type { Comment } from "../../domain/entities/Comment";
import { CanvasNotFoundError } from "../errors";
import type { AddCommentOutputDTO, GuestReviewerInputDTO } from "../dtos";
import type { CanvasRepository } from "../ports/CanvasRepository";
import type { Clock, IdGenerator } from "../ports/Runtime";
import { resolveReviewer } from "../reviewerInput";

export interface AddCommentInputDTO {
  readonly canvasId: string;
  readonly pinId: string;
  readonly author: GuestReviewerInputDTO;
  readonly body: string;
}

export class AddComment {
  constructor(
    private readonly canvases: CanvasRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: AddCommentInputDTO): Promise<AddCommentOutputDTO> {
    const canvas = await this.canvases.findById(input.canvasId);
    if (!canvas) {
      throw new CanvasNotFoundError(input.canvasId);
    }

    const createdAt = this.clock.now();
    const comment: Comment = createComment({
      id: this.ids.next("comment"),
      pinId: input.pinId,
      author: resolveReviewer(input.author, this.ids),
      body: input.body,
      createdAt,
    });
    const updatedCanvas = addCommentToPin(canvas, input.pinId, comment, createdAt);
    await this.canvases.save(updatedCanvas, canvas.revision);
    return comment;
  }
}
