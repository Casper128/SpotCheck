import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
]);

export class ImageStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageStorageError";
  }
}

export class LocalImageStorage {
  private readonly uploadDirectory = path.join(process.cwd(), "data", "uploads");

  async save(file: File): Promise<string> {
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      throw new ImageStorageError("La imagen debe pesar menos de 10 MB.");
    }

    const type = IMAGE_TYPES.get(file.type);
    if (!type) {
      throw new ImageStorageError("Solo se admiten imágenes PNG o JPG.");
    }

    const contents = Buffer.from(await file.arrayBuffer());
    if (!type.signature.every((byte, index) => contents[index] === byte)) {
      throw new ImageStorageError("El archivo no coincide con su formato de imagen.");
    }

    await mkdir(this.uploadDirectory, { recursive: true });
    const fileName = `${randomUUID()}.${type.extension}`;
    await writeFile(path.join(/*turbopackIgnore: true*/ this.uploadDirectory, fileName), contents, { flag: "wx" });
    return `/api/uploads/${fileName}`;
  }

  async remove(storedPath: string): Promise<void> {
    await unlink(path.join(/*turbopackIgnore: true*/ this.uploadDirectory, this.getFileName(storedPath)));
  }

  async load(storedPath: string): Promise<{ readonly contents: Uint8Array; readonly contentType: string }> {
    const fileName = this.getFileName(storedPath);
    const contents = await readFile(path.join(/*turbopackIgnore: true*/ this.uploadDirectory, fileName));
    const contentType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
    return { contents, contentType };
  }

  private getFileName(storedPath: string): string {
    const prefix = "/api/uploads/";
    const fileName = storedPath.startsWith(prefix) ? storedPath.slice(prefix.length) : "";
    if (!/^[\da-f-]{36}\.(png|jpg)$/.test(fileName) || path.basename(fileName) !== fileName) {
      throw new Error("Ruta de imagen no válida.");
    }
    return fileName;
  }
}
