import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@/application/ports/Runtime";

export class RandomIdGenerator implements IdGenerator {
  next(kind: "canvas" | "share" | "pin" | "comment" | "reviewer"): string {
    const id = randomUUID().replaceAll("-", "");
    return kind === "share" ? id.slice(0, 24) : `${kind}_${id}`;
  }
}
