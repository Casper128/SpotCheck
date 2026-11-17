import { normalizePageRoute, type ProjectWorkspace } from "@spotcheck/shared";
export function selectWorkspaceRoute(workspace: ProjectWorkspace, pageRoute: string) {
  if (!workspace.routes.some(route => route.path === pageRoute)) throw new Error("Elige una ruta que tenga pines.");
  const url = new URL(pageRoute, workspace.siteUrl);
  if (url.origin !== new URL(workspace.siteUrl).origin || url.username || url.password) throw new Error("La ruta no pertenece a este sitio.");
  return { href: url.href, pageRoute: normalizePageRoute(url.href) };
}
export function detectedWorkspaceRoute(workspace: ProjectWorkspace, href: string) {
  const url = new URL(href);
  if (workspace.project.imageSource.kind !== "external-url" || url.origin !== new URL(workspace.siteUrl).origin || url.username || url.password) throw new Error("La navegación está limitada al sitio de este proyecto.");
  return { href: url.href, pageRoute: normalizePageRoute(url.href) };
}

export interface WorkspaceLocation { readonly href: string; readonly pageRoute: string; readonly frameUrl: string; readonly frameRevision: number; }
export function transitionDetectedLocation(workspace: ProjectWorkspace, current: WorkspaceLocation, href: string): { location: WorkspaceLocation; error: Error | null } {
  try { return { location: { ...current, ...detectedWorkspaceRoute(workspace, href) }, error: null }; }
  catch (reason) {
    return { location: { href: workspace.siteUrl, pageRoute: normalizePageRoute(workspace.siteUrl), frameUrl: workspace.siteUrl, frameRevision: current.frameRevision + 1 },
      error: reason instanceof Error ? reason : new Error("La navegación está limitada al sitio de este proyecto.") };
  }
}
