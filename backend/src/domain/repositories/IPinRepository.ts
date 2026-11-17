import type { Pin } from "../entities/Pin";

export interface IPinRepository {
  findPinById(pinId: string): Promise<Pin | null>;
}
