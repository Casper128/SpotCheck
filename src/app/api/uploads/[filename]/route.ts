import { LocalImageStorage } from "@/infrastructure/storage/LocalImageStorage";

const imageStorage = new LocalImageStorage();

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly filename: string }> },
): Promise<Response> {
  const { filename } = await params;
  try {
    const image = await imageStorage.load(`/api/uploads/${filename}`);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(image.contents);
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": image.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return Response.json({ error: "No se encontró la imagen." }, { status: 404 });
    }
    console.error("Could not read uploaded image:", error);
    return Response.json({ error: "No se pudo cargar la imagen." }, { status: 500 });
  }
}
