import { Prisma, type PrismaClient } from "@prisma/client";
import { canvasSchema, pinSchema, workspaceSchema, normalizePageRoute, buildWorkspaceRoutes, type ProjectWorkspace, type Pin } from "@spotcheck/shared";
import type { WorkspaceQuery, WorkspaceQueryResult } from "../../application/ports/WorkspaceQuery";
import { belongsToProjectSite } from "../../domain/projectSite";
interface Row { actorId: string; actorStatus: string | null; actorOrganizationId: string | null; projectJson: string | null; pinJson: string | null; commentJson: string | null; }
function record(value: string): Record<string, unknown> { return JSON.parse(value) as Record<string, unknown>; }
function timestamp(value: unknown): string {
  if (typeof value !== "number" && typeof value !== "string") throw new Error("Fecha persistida no válida.");
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? value.replace(" ", "T") + "Z" : value;
  return new Date(normalized).toISOString();
}
function optional(key: string, value: unknown) { return value === null ? {} : { [key]: value }; }
function toWorkspace(rows: readonly Row[]): ProjectWorkspace | null {
  if (!rows[0]?.projectJson) return null;
  const project = record(rows[0].projectJson);
  const imageSource = project.sourceType === "image" ? { kind: "uploaded-path", path: project.imagePath } : { kind: "external-url", url: project.sourceUrl };
  const canvas = canvasSchema.parse({ id: project.id, shareId: project.shareId, imageSource,
    browserMetadata: { pageUrl: project.sourceUrl, pageTitle: project.title, viewportWidth: project.viewportWidth, viewportHeight: project.viewportHeight,
      ...optional("deviceScaleFactor", project.deviceScaleFactor), ...optional("userAgent", project.userAgent), capturedAt: timestamp(project.capturedAt) },
    createdAt: timestamp(project.createdAt), updatedAt: timestamp(project.updatedAt), revision: project.revision, pins: [] });
  const pins = new Map<string, { pin: Record<string, unknown>; comments: Record<string, unknown>[] }>();
  for (const row of rows) {
    if (!row.pinJson) continue;
    const data = record(row.pinJson);
    if (typeof data.id !== "string" || typeof data.reviewedUrl !== "string" || !belongsToProjectSite(canvas, data.reviewedUrl)
      || typeof data.pageRoute !== "string" || normalizePageRoute(data.reviewedUrl) !== normalizePageRoute(data.pageRoute)) continue;
    let entry = pins.get(data.id);
    if (!entry) { entry = { pin: data, comments: [] }; pins.set(data.id, entry); }
    if (row.commentJson) entry.comments.push(record(row.commentJson));
  }
  const valid: Pin[] = [];
  for (const { pin: p, comments } of pins.values()) {
    const result = pinSchema.safeParse({ id: p.id, pageRoute: p.pageRoute, pinNumber: p.pinNumber, x: p.x, y: p.y, status: p.status,
      ...(p.domSelector === null ? {} : { domAnchor: { selector: p.domSelector, offsetX: p.domOffsetX, offsetY: p.domOffsetY } }),
      createdBy: { id: p.createdById, displayName: p.createdByName }, createdAt: timestamp(p.createdAt),
      ...(p.resolvedById === null ? {} : { resolvedBy: { id: p.resolvedById, displayName: p.resolvedByName }, resolvedAt: timestamp(p.resolvedAt) }),
      snapshot: { reviewedUrl: p.reviewedUrl, viewport: { width: p.browserWidth, height: p.browserHeight },
        ...(p.scrollX === null || p.scrollY === null ? {} : { scrollOffset: { x: p.scrollX, y: p.scrollY } }),
        browser: { name: p.browserName, ...optional("version", p.browserVersion) }, operatingSystem: { name: p.operatingSystem, ...optional("version", p.operatingSystemVersion) } },
      comments: comments.map(c => ({ id: c.id, pinId: c.pinId, author: { id: c.authorId, displayName: c.authorName }, body: c.body, createdAt: timestamp(c.createdAt), ...optional("replyToCommentId", c.replyToCommentId) })) });
    if (result.success) valid.push(result.data);
  }
  return workspaceSchema.parse({ project: { ...canvas, pins: valid }, siteUrl: canvas.imageSource.kind === "external-url" ? canvas.imageSource.url : canvas.browserMetadata.pageUrl,
    routes: buildWorkspaceRoutes(valid) });
}
export class PrismaWorkspaceQuery implements WorkspaceQuery {
  constructor(private readonly database: PrismaClient) {}
  async execute(actorId: string, identifier: string): Promise<WorkspaceQueryResult> {
    const rows = await this.database.$queryRaw<Row[]>(Prisma.sql`
      WITH actor AS (
        SELECT u.id AS "actorId", m.status AS "actorStatus", m."organizationId" AS "actorOrganizationId"
        FROM "User" u LEFT JOIN "OrganizationMembership" m ON m."userId" = u.id WHERE u.id = ${actorId}
      )
      SELECT actor.*,
        CASE WHEN c.id IS NULL THEN NULL ELSE row_to_json(c)::text END AS "projectJson",
        CASE WHEN p.id IS NULL THEN NULL ELSE row_to_json(p)::text END AS "pinJson",
        CASE WHEN co.id IS NULL THEN NULL ELSE row_to_json(co)::text END AS "commentJson"
      FROM actor
      LEFT JOIN "Canvas" c ON c."organizationId" = actor."actorOrganizationId" AND (c.id = ${identifier} OR c."shareId" = ${identifier})
      LEFT JOIN "Pin" p ON p."canvasId" = c.id
      LEFT JOIN "Comment" co ON co."pinId" = p.id
      ORDER BY p."pinNumber", co."createdAt", co.id
    `);
    return { actorId: rows[0]?.actorId ?? null, status: rows[0]?.actorStatus ?? null, organizationId: rows[0]?.actorOrganizationId ?? null, workspace: toWorkspace(rows) };
  }
}
