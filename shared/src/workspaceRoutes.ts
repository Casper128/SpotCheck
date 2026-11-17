import type { Pin, WorkspaceRoute } from "./dtos";
export function buildWorkspaceRoutes(pins: readonly Pick<Pin, "pageRoute" | "status">[]): readonly WorkspaceRoute[] {
  const routes = new Map<string, WorkspaceRoute>();
  for (const pin of pins) {
    const current = routes.get(pin.pageRoute) ?? { path: pin.pageRoute, pinCount: 0, openPinCount: 0 };
    routes.set(pin.pageRoute, { path: pin.pageRoute, pinCount: current.pinCount + 1, openPinCount: current.openPinCount + (pin.status === "open" ? 1 : 0) });
  }
  return [...routes.values()].sort((a, b) => a.path.localeCompare(b.path));
}
