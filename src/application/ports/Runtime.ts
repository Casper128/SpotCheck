export type IdKind = "canvas" | "share" | "pin" | "comment" | "reviewer";

export interface IdGenerator {
  next(kind: IdKind): string;
}

export interface Clock {
  now(): string;
}
