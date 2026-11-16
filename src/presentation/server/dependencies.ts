import { AddComment, AddPin, CreateCanvas, GetCanvas, ReplyToComment, ResolvePin } from "@/application";
import { SystemClock } from "@/infrastructure/database/clock";
import { RandomIdGenerator } from "@/infrastructure/database/ids";
import { PrismaCanvasRepository } from "@/infrastructure/repositories/PrismaCanvasRepository";

export const canvasRepository = new PrismaCanvasRepository();
const ids = new RandomIdGenerator();
const clock = new SystemClock();

export const useCases = {
  addComment: new AddComment(canvasRepository, ids, clock),
  addPin: new AddPin(canvasRepository, ids, clock),
  createCanvas: new CreateCanvas(canvasRepository, ids, clock),
  getCanvas: new GetCanvas(canvasRepository),
  replyToComment: new ReplyToComment(canvasRepository, ids, clock),
  resolvePin: new ResolvePin(canvasRepository, ids, clock),
};
