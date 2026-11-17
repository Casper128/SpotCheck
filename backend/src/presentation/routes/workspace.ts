import type { FastifyInstance } from "fastify";
import type { GetProjectWorkspace } from "../../application/use-cases/GetProjectWorkspace";
import type { RequestAccess } from "../middleware/access";
export function registerWorkspaceRoutes(app: FastifyInstance, access: RequestAccess, getWorkspace: GetProjectWorkspace) {
  app.get<{ Params: { id: string } }>("/api/projects/:id/workspace", async (request, reply) => {
    const workspace = await getWorkspace.execute(access.userId(request), request.params.id);
    return reply.header("cache-control", "private, no-store").send({ workspace });
  });
}
