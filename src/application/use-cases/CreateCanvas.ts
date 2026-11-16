import { createBrowserMetadata } from "../../domain/entities/BrowserMetadata";
import { createCanvas } from "../../domain/entities/Canvas";
import type { CreateCanvasInputDTO, CreateCanvasOutputDTO } from "../dtos";
import type { CanvasRepository } from "../ports/CanvasRepository";
import type { Clock, IdGenerator } from "../ports/Runtime";

export class CreateCanvas {
  constructor(
    private readonly canvases: CanvasRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateCanvasInputDTO): Promise<CreateCanvasOutputDTO> {
    const now = this.clock.now();
    const browserMetadata = createBrowserMetadata({
      pageUrl: input.pageUrl,
      pageTitle: input.pageTitle ?? "",
      viewportWidth: input.viewportWidth,
      viewportHeight: input.viewportHeight,
      ...(input.deviceScaleFactor === undefined ? {} : { deviceScaleFactor: input.deviceScaleFactor }),
      ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
      capturedAt: now,
    });
    const canvas = createCanvas({
      id: this.ids.next("canvas"),
      shareId: this.ids.next("share"),
      imageSource: input.imageSource,
      browserMetadata,
      createdAt: now,
    });

    await this.canvases.create(canvas);
    return canvas;
  }
}
