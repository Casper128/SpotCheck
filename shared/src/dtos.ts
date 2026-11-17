import type { z } from "zod";
import type * as schemas from "./schemas";

export type Canvas = z.infer<typeof schemas.canvasSchema>;
export type CanvasSummary = z.infer<typeof schemas.canvasSummarySchema>;
export type Pin = z.infer<typeof schemas.pinSchema>;
export type PinStatus = Pin["status"];
export type DOMAnchor = z.infer<typeof schemas.domAnchorSchema>;
export type Comment = z.infer<typeof schemas.commentSchema>;
export type GuestReviewer = z.infer<typeof schemas.reviewerSchema>;
export type BrowserMetadata = z.infer<typeof schemas.browserMetadataSchema>;
export type ImageSource = z.infer<typeof schemas.imageSourceSchema>;
export type PinSnapshotMetadata = z.infer<typeof schemas.pinSnapshotSchema>;
export type AddPinRequest = z.infer<typeof schemas.addPinRequestSchema>;
export type AddCommentRequest = z.infer<typeof schemas.addCommentRequestSchema>;
export type ResolvePinRequest = z.infer<typeof schemas.resolvePinRequestSchema>;
export type CreateCanvasFields = z.infer<typeof schemas.createCanvasFieldsSchema>;
export type CanvasResponse = z.infer<typeof schemas.canvasResponseSchema>;
export type CanvasListResponse = z.infer<typeof schemas.canvasListResponseSchema>;
export type CreatedCanvasResponse = z.infer<typeof schemas.createdCanvasResponseSchema>;
export type PinResponse = z.infer<typeof schemas.pinResponseSchema>;
export type CommentResponse = z.infer<typeof schemas.commentResponseSchema>;
export type ApiError = z.infer<typeof schemas.apiErrorSchema>;
export type PublicConfig = z.infer<typeof schemas.publicConfigSchema>;

export type Account = z.infer<typeof schemas.accountSchema>;
export type SessionResponse = z.infer<typeof schemas.sessionResponseSchema>;
export type AuthChallenge = z.infer<typeof schemas.authChallengeSchema>;

export type ProjectWorkspace = z.infer<typeof schemas.workspaceSchema>;
export type WorkspaceRoute = z.infer<typeof schemas.workspaceRouteSchema>;
