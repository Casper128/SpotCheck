import type { FastifyInstance } from "fastify";
import { googleLoginSchema } from "@spotcheck/shared";
import { AccessError } from "../../domain/ports/IdentityRepository";
import type { RequestAccess } from "../middleware/access";
import { RequestValidationError } from "../middleware/apiErrors";
export function registerAuthRoutes(app: FastifyInstance, access: RequestAccess, configured: boolean) {
  app.get("/api/auth/challenge", async (_request, reply) => {
    if (!configured) throw new AccessError(503, "El acceso con Google aún no está configurado.");
    const challenge = access.sessions.challenge();
    return reply.header("cache-control", "no-store").header("set-cookie", challenge.cookie).send({ nonce: challenge.nonce });
  });
  app.post("/api/auth/google", async (request, reply) => {
    if (!configured) throw new AccessError(503, "El acceso con Google aún no está configurado.");
    const input = googleLoginSchema.safeParse(request.body);
    if (!input.success) throw new RequestValidationError("La credencial de Google no es válida.");
    const nonce = access.sessions.consumeChallenge(request.headers.cookie);
    reply.header("set-cookie", access.sessions.cookie(access.sessions.challengeName, "", 0));
    const account = await access.accountsService.login(input.data.credential, nonce);
    return reply.header("cache-control", "no-store").header("set-cookie", [access.sessions.cookie(access.sessions.challengeName, "", 0), access.sessions.issue(account.id)]).send({ account });
  });
  app.get("/api/auth/me", async (request, reply) => reply.header("cache-control", "no-store").send({ account: await access.accountsService.account(access.userId(request)) }));
  app.post("/api/auth/logout", async (_request, reply) => reply.header("set-cookie", access.sessions.cookie(access.sessions.sessionName, "", 0)).header("cache-control", "no-store").send({ ok: true }));
}
