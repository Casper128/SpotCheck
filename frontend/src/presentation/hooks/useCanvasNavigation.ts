import { useCallback, useMemo, useState } from "react";
import { normalizePageRoute, type ProjectWorkspace } from "@spotcheck/shared";
import { selectWorkspaceRoute, transitionDetectedLocation } from "@/application/workspaceNavigation";
import { reviewService } from "@/presentation/dependencies";
export function useCanvasNavigation(workspace: ProjectWorkspace) {
  const [location, setLocation] = useState(() => ({ href: workspace.siteUrl, pageRoute: normalizePageRoute(workspace.siteUrl), frameUrl: workspace.siteUrl, frameRevision: 0 }));
  const pageRoute = location.pageRoute;
  const canvas = useMemo(() => ({ ...workspace.project, pins: workspace.project.pins.filter(pin => pin.pageRoute === pageRoute) }), [workspace.project, pageRoute]);
  const sourceUrl = canvas.imageSource.kind === "external-url" ? canvas.imageSource.url : reviewService.imageUrl(canvas.imageSource.path);
  const applyRoute = useCallback((path: string) => { const target = selectWorkspaceRoute(workspace, path); setLocation(current => ({ ...target, frameUrl: target.href, frameRevision: current.frameRevision + 1 })); }, [workspace]);
  const applyDetectedRoute = useCallback((href: string) => {
    const transition = transitionDetectedLocation(workspace, location, href);
    setLocation(transition.location);
    if (transition.error) throw transition.error;
  }, [workspace, location]);
  return { canvas, pageRoute, routes: workspace.routes, sourceUrl, reviewedUrl: location.href, frameUrl: location.frameUrl, frameRevision: location.frameRevision, applyRoute, applyDetectedRoute };
}
