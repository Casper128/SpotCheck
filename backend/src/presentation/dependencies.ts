import { AddComment, AddPin, CreateCanvas, GetCanvas, GetPinsByRoute, ReplyToComment, ResolvePin } from "../application";
import type { ReviewRepository } from "../application/ports/ReviewRepository";
import { SystemClock } from "../infrastructure/database/clock";
import { RandomIdGenerator } from "../infrastructure/database/ids";
import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { BackendConfig } from "../infrastructure/config/environment";
import { PrismaCanvasRepository } from "../infrastructure/repositories/PrismaCanvasRepository";
import { PrismaIdentityRepository } from "../infrastructure/repositories/PrismaIdentityRepository";
import { GoogleIdentityVerifier } from "../infrastructure/auth/GoogleIdentityVerifier";
import { CookieSessions } from "../infrastructure/auth/CookieSessions";
import { GetProjectWorkspace } from "../application/use-cases/GetProjectWorkspace";
import { PrismaWorkspaceQuery } from "../infrastructure/repositories/PrismaWorkspaceQuery";
import { AccountAccess } from "../application/use-cases/AccountAccess";
import { AccessError, type IdentityRepository, type GoogleIdentityVerifier as IdentityVerifier } from "../domain/ports/IdentityRepository";
import { RequestAccess } from "./middleware/access";
export function createUseCases(repository: ReviewRepository) {
  const ids = new RandomIdGenerator();
  const clock = new SystemClock();
  return {
    addComment: new AddComment(repository, ids, clock),
    addPin: new AddPin(repository, ids, clock),
    createCanvas: new CreateCanvas(repository, ids, clock),
    getCanvas: new GetCanvas(repository),
    getPinsByRoute: new GetPinsByRoute(repository, repository),
    replyToComment: new ReplyToComment(repository, ids, clock),
    resolvePin: new ResolvePin(repository, ids, clock),
  };
}
export type UseCases = ReturnType<typeof createUseCases>;

export interface AuthDependencies { readonly identityRepository?: IdentityRepository; readonly googleVerifier?: IdentityVerifier; readonly repositoryForOrganization?: (organizationId: string) => ReviewRepository; }
export function createDependencies(database: PrismaClient | null, config: BackendConfig, options: AuthDependencies) {
  const unavailable: IdentityRepository = { async register() { throw new AccessError(503, "El acceso aún no está disponible."); }, async findAccount() { return null; } };
  const identities = options.identityRepository ?? (database ? new PrismaIdentityRepository(database) : unavailable);
  const access = new RequestAccess(new CookieSessions(config.sessionSecret, config.cookieSecure, config.frontendOrigin), new AccountAccess(identities, options.googleVerifier ?? new GoogleIdentityVerifier(config.googleClientId)));
  const forOrganization = options.repositoryForOrganization ?? ((organizationId: string) => {
    if (!database) throw new AccessError(503, "El almacenamiento aún no está disponible.");
    return new PrismaCanvasRepository(database, organizationId);
  });
  const review = async (request: FastifyRequest) => {
    const account = await access.member(request);
    const repository = forOrganization(account.organizationId);
    return { account, repository, useCases: createUseCases(repository) };
  };
  const imageAllowed = async (request: FastifyRequest, imagePath: string) => {
    const account = await access.member(request);
    if (!database) return false;
    return new PrismaCanvasRepository(database, account.organizationId).hasImage(imagePath);
  };
  const getWorkspace = database ? new GetProjectWorkspace(new PrismaWorkspaceQuery(database)) : null;
  return { access, review, imageAllowed, getWorkspace };
}
export type ReviewContext = ReturnType<typeof createDependencies>["review"];
export type ImageAccess = ReturnType<typeof createDependencies>["imageAllowed"];
