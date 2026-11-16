import { assertNonBlank, DomainError } from "../errors";

export interface GuestReviewer {
  readonly id: string;
  readonly displayName: string;
  readonly email?: string;
}

export interface GuestReviewerAttributes {
  readonly id: string;
  readonly displayName: string;
  readonly email?: string;
}

export function createGuestReviewer(attributes: GuestReviewerAttributes): GuestReviewer {
  const id = assertNonBlank(attributes.id, "reviewer.id");
  const displayName = assertNonBlank(attributes.displayName, "reviewer.displayName");
  if (displayName.length > 80) {
    throw new DomainError("displayName must be at most 80 characters.", "INVALID_VALUE", "reviewer.displayName");
  }

  const email = attributes.email?.trim();
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new DomainError("email must be a valid email address.", "INVALID_VALUE", "reviewer.email");
  }

  return { id, displayName, ...(email ? { email } : {}) };
}
