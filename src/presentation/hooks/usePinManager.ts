import { useCallback } from "react";
import type { MouseEvent, RefObject } from "react";
import type { Canvas } from "@/domain/entities/Canvas";
import type { DOMAnchor, Pin } from "@/domain/entities/Pin";
import type { GuestSession } from "@/presentation/store/reviewStore";
import type { PinPlacementMode } from "@/presentation/domInspectorProtocol";
import { normalizePageRoute } from "@/domain/normalizePageRoute";
import { requestJson } from "./reviewApi";

function getBrowserDetails(userAgent: string) {
  const browsers: readonly [RegExp, string][] = [
    [/Edg\/([\d.]+)/, "Microsoft Edge"], [/Firefox\/([\d.]+)/, "Firefox"],
    [/Chrome\/([\d.]+)/, "Chrome"], [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  const operatingSystems: readonly [RegExp, string][] = [
    [/Windows NT ([\d.]+)/, "Windows"], [/Mac OS X ([\d_]+)/, "macOS"],
    [/Android ([\d.]+)/, "Android"], [/iPhone OS ([\d_]+)/, "iOS"], [/Linux/, "Linux"],
  ];
  const browser = browsers.map(([pattern, name]) => ({ match: userAgent.match(pattern), name })).find((entry) => entry.match);
  const os = operatingSystems.map(([pattern, name]) => ({ match: userAgent.match(pattern), name })).find((entry) => entry.match);
  return {
    browser: browser?.match ? { name: browser.name, version: browser.match[1] } : { name: "Navegador" },
    operatingSystem: os?.match ? { name: os.name, version: os.match[1]?.replaceAll("_", ".") } : { name: "Sistema operativo" },
  };
}

export function usePinManager(options: {
  readonly canvas: Canvas;
  readonly pageRoute: string;
  readonly reviewedUrl: string;
  readonly reviewer: GuestSession | null;
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly busy: boolean;
  readonly setBusy: (busy: boolean) => void;
  readonly setError: (error: string | null) => void;
  readonly reloadCanvas: (route?: string) => Promise<Canvas>;
  readonly setFilter: (filter: "open" | "resolved") => void;
  readonly setSelectedPinId: (pinId: string | null) => void;
  readonly setPlacementMode: (mode: PinPlacementMode) => void;
}) {
  const addPinAt = useCallback(async (point: {
    readonly x: number;
    readonly y: number;
    readonly domAnchor?: DOMAnchor;
    readonly reviewedUrl?: string;
    readonly viewport?: { readonly width: number; readonly height: number };
    readonly scrollOffset?: { readonly x: number; readonly y: number };
  }) => {
    if (!options.reviewer || options.busy || !options.surfaceRef.current) return;
    const reviewedUrl = point.reviewedUrl ?? options.reviewedUrl;
    const pageRoute = point.reviewedUrl ? normalizePageRoute(point.reviewedUrl) : options.pageRoute;
    options.setBusy(true);
    options.setError(null);
    try {
      await requestJson<{ readonly pin: Pin }>(`/api/canvases/${encodeURIComponent(options.canvas.shareId)}/pins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          x: point.x, y: point.y, pageRoute, author: options.reviewer,
          ...(point.domAnchor ? { domAnchor: point.domAnchor } : {}),
          snapshot: {
            reviewedUrl,
            viewport: point.viewport ?? { width: window.innerWidth, height: window.innerHeight },
            ...(point.scrollOffset ? { scrollOffset: point.scrollOffset } : {}),
            ...getBrowserDetails(navigator.userAgent),
          },
        }),
      }).then(({ pin }) => {
        options.setFilter("open");
        options.setSelectedPinId(pin.id);
        options.setPlacementMode("off");
      });
      await options.reloadCanvas(pageRoute);
    } catch (error) {
      options.setError(error instanceof Error ? error.message : "No se pudo crear el comentario.");
    } finally {
      options.setBusy(false);
    }
  }, [options]);

  const addPin = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!options.surfaceRef.current) return;
    const bounds = options.surfaceRef.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    return addPinAt({
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
      viewport: { width: bounds.width, height: bounds.height },
    });
  }, [addPinAt, options.surfaceRef]);

  const resolvePin = useCallback(async (pin: Pin, onResolved: () => void) => {
    if (!options.reviewer || options.busy) return;
    options.setBusy(true);
    options.setError(null);
    try {
      await requestJson<{ readonly pin: Pin }>(
        `/api/canvases/${encodeURIComponent(options.canvas.shareId)}/pins/${encodeURIComponent(pin.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resolvedBy: options.reviewer, pageRoute: options.pageRoute }),
        },
      );
      onResolved();
      await options.reloadCanvas();
    } catch (error) {
      options.setError(error instanceof Error ? error.message : "No se pudo resolver el punto.");
    } finally {
      options.setBusy(false);
    }
  }, [options]);

  return { addPin, addPinAt, resolvePin };
}
