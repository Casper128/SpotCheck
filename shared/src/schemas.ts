import { z } from "zod";

const id = z.string().min(1).max(200);
const timestamp = z.iso.datetime();
const coordinate = z.number().finite().min(0).max(1);
export const httpUrlSchema = z.url({ protocol: /^https?$/ }).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password;
}, "La URL no puede incluir credenciales.");
export const pageRouteSchema = z.string().trim().min(1).max(2048);
export const reviewerSchema = z.object({
  id: z.string().min(1).max(100),
  displayName: z.string().trim().min(1).max(80),
  email: z.email().max(254).optional(),
});
export const domAnchorSchema = z.object({
  selector: z.string().min(1).max(1200).refine((value) => value.trim().length > 0),
  offsetX: coordinate,
  offsetY: coordinate,
});
const namedVersion = z.object({ name: z.string().trim().min(1).max(100), version: z.string().trim().max(50).optional() });
export const pinSnapshotSchema = z.object({
  reviewedUrl: httpUrlSchema,
  viewport: z.object({ width: z.number().finite().positive(), height: z.number().finite().positive() }),
  scrollOffset: z.object({ x: z.number().finite().min(-100_000).max(100_000), y: z.number().finite().min(-100_000).max(100_000) }).optional(),
  browser: namedVersion,
  operatingSystem: namedVersion,
});
export const browserMetadataSchema = z.object({
  pageUrl: httpUrlSchema,
  pageTitle: z.string().max(200),
  viewportWidth: z.number().finite().positive(),
  viewportHeight: z.number().finite().positive(),
  deviceScaleFactor: z.number().finite().positive().optional(),
  userAgent: z.string().max(1000).optional(),
  capturedAt: timestamp,
});
export const imageSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("external-url"), url: httpUrlSchema }),
  z.object({ kind: z.literal("uploaded-path"), path: z.string().regex(/^\/api\/uploads\/[\da-f-]{36}\.(png|jpg)$/) }),
]);
export const commentSchema = z.object({
  id, pinId: id, author: reviewerSchema, body: z.string().trim().min(1).max(5000), createdAt: timestamp, replyToCommentId: id.optional(),
});
export const pinSchema = z.object({
  id, pageRoute: pageRouteSchema, pinNumber: z.number().int().positive(), x: coordinate, y: coordinate,
  domAnchor: domAnchorSchema.optional(), status: z.enum(["open", "resolved"]), createdBy: reviewerSchema,
  createdAt: timestamp, snapshot: pinSnapshotSchema, resolvedBy: reviewerSchema.optional(), resolvedAt: timestamp.optional(),
  comments: z.array(commentSchema).readonly(),
});
export const canvasSchema = z.object({
  id, shareId: id, imageSource: imageSourceSchema, browserMetadata: browserMetadataSchema,
  createdAt: timestamp, updatedAt: timestamp, revision: z.number().int().nonnegative(), pins: z.array(pinSchema).readonly(),
});
export const canvasSummarySchema = z.object({
  id, shareId: id, title: z.string(), sourceType: z.enum(["web", "image"]), sourceUrl: z.string().nullable(), imagePath: z.string().nullable(),
  createdAt: timestamp, pinCount: z.number().int().nonnegative(), openPinCount: z.number().int().nonnegative(),
});
export const addPinRequestSchema = z.object({
  x: coordinate, y: coordinate, pageRoute: pageRouteSchema, domAnchor: domAnchorSchema.optional(), author: reviewerSchema, snapshot: pinSnapshotSchema,
});
export const addCommentRequestSchema = z.object({
  pageRoute: pageRouteSchema, body: z.string().trim().min(1).max(5000), replyToCommentId: id.optional(), author: reviewerSchema,
});
export const resolvePinRequestSchema = z.object({ pageRoute: pageRouteSchema, resolvedBy: reviewerSchema });
export const createCanvasFieldsSchema = z.object({
  sourceType: z.enum(["web", "image"]), title: z.string().trim().max(120),
  viewportWidth: z.coerce.number().finite().positive(), viewportHeight: z.coerce.number().finite().positive(),
  deviceScaleFactor: z.coerce.number().finite().positive(), userAgent: z.string().max(1000), url: httpUrlSchema.optional(),
});
export const canvasResponseSchema = z.object({ canvas: canvasSchema });
export const canvasListResponseSchema = z.object({ canvases: z.array(canvasSummarySchema).readonly() });
export const createdCanvasResponseSchema = z.object({ id, shareId: id });
export const pinResponseSchema = z.object({ pin: pinSchema });
export const commentResponseSchema = z.object({ comment: commentSchema });
export const apiErrorSchema = z.object({ error: z.string(), field: z.string().optional() });
export const accountSchema = z.object({
  id, email: z.email(), displayName: z.string(), organizationId: id.nullable(), organizationName: z.string().nullable(), status: z.enum(["pending", "approved", "rejected"]),
});
export const sessionResponseSchema = z.object({ account: accountSchema });
export const authChallengeSchema = z.object({ nonce: z.string().min(16) });
export const googleLoginSchema = z.object({ credential: z.string().min(1).max(20_000) }).strict();
export const publicConfigSchema = z.object({ proxyOrigin: z.string().nullable(), googleClientId: z.string().nullable(), googleConfigured: z.boolean() }).strict();

export const workspaceRouteSchema = z.object({ path: pageRouteSchema, pinCount: z.number().int().nonnegative(), openPinCount: z.number().int().nonnegative() });
export const workspaceSchema = z.object({ project: canvasSchema, siteUrl: httpUrlSchema, routes: z.array(workspaceRouteSchema).readonly() });
export const workspaceResponseSchema = z.object({ workspace: workspaceSchema });
