import { z } from "zod";
import { apiError, RequestValidationError } from "@/presentation/server/apiErrors";
import { canvasRepository, useCases } from "@/presentation/server/dependencies";
import { LocalImageStorage } from "@/infrastructure/storage/LocalImageStorage";

const imageStorage = new LocalImageStorage();

export async function GET(): Promise<Response> {
  try {
    return Response.json({ canvases: await canvasRepository.listSummaries() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  let storedImagePath: string | null = null;
  try {
    const form = await request.formData();
    const sourceType = form.get("sourceType");
    const title = getText(form, "title").trim();
    const viewportWidth = parsePositiveNumber(getText(form, "viewportWidth"), "Ancho de ventana");
    const viewportHeight = parsePositiveNumber(getText(form, "viewportHeight"), "Alto de ventana");
    const deviceScaleFactor = parsePositiveNumber(getText(form, "deviceScaleFactor"), "Escala de pantalla");
    const userAgent = getText(form, "userAgent");

    if (title.length > 120) {
      return Response.json({ error: "El nombre del proyecto admite hasta 120 caracteres." }, { status: 400 });
    }

    let imageSource: { readonly kind: "external-url"; readonly url: string } | { readonly kind: "uploaded-path"; readonly path: string };
    let pageUrl: string;
    if (sourceType === "web") {
      const url = z.url({ protocol: /^https?$/ }).safeParse(getText(form, "url"));
      if (!url.success) {
        return Response.json({ error: "Escribe una URL válida que comience por http:// o https://." }, { status: 400 });
      }
      const parsed = new URL(url.data);
      if (parsed.username || parsed.password) {
        return Response.json({ error: "La URL no puede incluir credenciales." }, { status: 400 });
      }
      imageSource = { kind: "external-url", url: url.data };
      pageUrl = url.data;
    } else if (sourceType === "image") {
      const image = form.get("image");
      if (!(image instanceof File)) {
        return Response.json({ error: "Elige una imagen PNG o JPG." }, { status: 400 });
      }
      storedImagePath = await imageStorage.save(image);
      imageSource = { kind: "uploaded-path", path: storedImagePath };
      pageUrl = new URL(storedImagePath, request.url).toString();
    } else {
      return Response.json({ error: "Elige un tipo de contenido válido." }, { status: 400 });
    }

    const canvas = await useCases.createCanvas.execute({
      imageSource,
      pageUrl,
      pageTitle: title || (sourceType === "web" ? new URL(pageUrl).hostname : "Imagen sin título"),
      viewportWidth,
      viewportHeight,
      deviceScaleFactor,
      userAgent,
    });

    return Response.json({ id: canvas.id, shareId: canvas.shareId }, { status: 201 });
  } catch (error) {
    if (storedImagePath) {
      try {
        await imageStorage.remove(storedImagePath);
      } catch (cleanupError) {
        console.error("Could not remove an image after canvas creation failed:", cleanupError);
      }
    }
    return apiError(error);
  }
}

function getText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new RequestValidationError(`${label} no válido.`);
  }
  return parsed;
}
