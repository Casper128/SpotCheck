import type { ProjectWorkspace } from "@spotcheck/shared";
import type { ReviewApi } from "./ReviewApi";
export interface WorkspaceApi extends Pick<ReviewApi, "addPin" | "addComment" | "resolvePin" | "assetUrl"> {
  getWorkspace(identifier: string): Promise<ProjectWorkspace>;
}
