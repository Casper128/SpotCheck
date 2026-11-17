import type { ProjectWorkspace } from "@spotcheck/shared";
export interface WorkspaceQueryResult { readonly actorId: string | null; readonly status: string | null; readonly organizationId: string | null; readonly workspace: ProjectWorkspace | null; }
export interface WorkspaceQuery { execute(actorId: string, identifier: string): Promise<WorkspaceQueryResult>; }
