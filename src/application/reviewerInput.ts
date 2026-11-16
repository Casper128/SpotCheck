import { createGuestReviewer } from "../domain/entities/GuestReviewer";
import type { GuestReviewer } from "../domain/entities/GuestReviewer";
import type { GuestReviewerInputDTO } from "./dtos";
import type { IdGenerator } from "./ports/Runtime";

export function resolveReviewer(input: GuestReviewerInputDTO, ids: IdGenerator): GuestReviewer {
  return createGuestReviewer({
    id: input.reviewerId ?? ids.next("reviewer"),
    displayName: input.displayName,
    ...(input.email === undefined ? {} : { email: input.email }),
  });
}
