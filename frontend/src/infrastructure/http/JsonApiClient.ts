import { z } from "zod";
import { apiErrorSchema } from "@spotcheck/shared";
import { ReviewApiError } from "../../domain/ports/ReviewApi";
export class JsonApiClient {
  protected readonly origin: string;
  constructor(origin: string, private readonly transport: typeof fetch = globalThis.fetch.bind(globalThis)) {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) throw new Error("El origen de API no es válido.");
    this.origin = parsed.origin;
  }
  protected async request<T>(pathname: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    let response: Response;
    try { response = await this.transport(new URL(pathname, this.origin), { ...init, credentials: "include" }); }
    catch { throw new ReviewApiError("No se pudo conectar con la API. Inténtalo de nuevo."); }
    let body: unknown;
    try { body = await response.json(); } catch { throw new ReviewApiError("La API devolvió una respuesta no válida.", response.status); }
    if (!response.ok) { const error = apiErrorSchema.safeParse(body); throw new ReviewApiError(error.success ? error.data.error : "No se pudo completar la acción.", response.status); }
    const result = schema.safeParse(body);
    if (!result.success) throw new ReviewApiError("La API devolvió una respuesta no válida.", response.status);
    return result.data;
  }
  protected json(method: string, body: unknown): RequestInit { return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }; }
}
