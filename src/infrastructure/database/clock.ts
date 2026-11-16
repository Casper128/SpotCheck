import type { Clock } from "@/application/ports/Runtime";

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}
