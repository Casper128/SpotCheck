import type { WorkspaceQuery } from "../ports/WorkspaceQuery";
import { AccessError } from "../../domain/ports/IdentityRepository";
import { DomainError } from "../../domain/errors";
import { CanvasNotFoundError } from "../errors";
export class GetProjectWorkspace {
  constructor(private readonly query: WorkspaceQuery) {}
  async execute(actorId: string, identifier: string) {
    if (!identifier || identifier.length > 200) throw new DomainError("El identificador del proyecto no es válido.", "INVALID_VALUE", "projectId");
    const result = await this.query.execute(actorId, identifier);
    if (!result.actorId) throw new AccessError(401, "Inicia sesión para continuar.");
    if (!result.organizationId) throw new AccessError(503, "No se pudo preparar tu espacio. Vuelve a iniciar sesión.");
    if (!result.workspace) throw new CanvasNotFoundError(identifier);
    return result.workspace;
  }
}
