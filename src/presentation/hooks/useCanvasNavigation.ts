import { useCallback, useRef, useState } from "react";
import type { Canvas } from "@/domain/entities/Canvas";
import { normalizePageRoute } from "@/domain/normalizePageRoute";
import { resolveReviewPage } from "@/presentation/resolveReviewPage";
import { requestJson } from "./reviewApi";

export function useCanvasNavigation(initialCanvas: Canvas) {
  const sourceUrl = initialCanvas.imageSource.kind === "external-url"
    ? initialCanvas.imageSource.url
    : initialCanvas.imageSource.path;
  const initialRoute = normalizePageRoute(initialCanvas.browserMetadata.pageUrl);
  const [canvas, setCanvas] = useState<Canvas>(() => ({
    ...initialCanvas,
    pins: initialCanvas.pins.filter((pin) => pin.pageRoute === initialRoute),
  }));
  const [pageRoute, setPageRoute] = useState(initialRoute);
  const [routeDraft, setRouteDraft] = useState(
    initialCanvas.imageSource.kind === "external-url" ? initialCanvas.browserMetadata.pageUrl : initialRoute,
  );
  const [reviewedUrl, setReviewedUrl] = useState(initialCanvas.browserMetadata.pageUrl);
  const [frameUrl, setFrameUrl] = useState(initialCanvas.browserMetadata.pageUrl);
  const [routes, setRoutes] = useState(() => [...new Set([initialRoute, ...initialCanvas.pins.map((pin) => pin.pageRoute)])].sort());
  const loadSequence = useRef(0);
  const activeRoute = useRef(initialRoute);

  const reloadCanvas = useCallback(async (route = pageRoute) => {
    // A write started on an old page may finish after navigation. Its refresh
    // must neither replace the active page nor invalidate its pending request.
    const requestId = route === activeRoute.current ? ++loadSequence.current : -1;
    const result = await requestJson<{ readonly canvas: Canvas }>(
      `/api/canvases/${encodeURIComponent(initialCanvas.shareId)}?pageRoute=${encodeURIComponent(route)}`,
    );
    if (requestId === loadSequence.current && route === activeRoute.current) {
      setCanvas(result.canvas);
      setRoutes((existing) => [...new Set([...existing, ...result.canvas.pins.map((pin) => pin.pageRoute)])].sort());
    }
    return result.canvas;
  }, [initialCanvas.shareId, pageRoute]);

  const applyRoute = useCallback(async (value = routeDraft) => {
    if (!value.trim()) throw new Error("Introduce una URL o ruta de página.");
    let nextRoute = normalizePageRoute(value);
    let targetUrl: string | null = null;
    if (initialCanvas.imageSource.kind === "external-url") {
      const target = resolveReviewPage(value, reviewedUrl);
      targetUrl = target.url;
      nextRoute = target.pageRoute;
    }
    activeRoute.current = nextRoute;
    setPageRoute(nextRoute);
    setRouteDraft(value);
    setRoutes((existing) => [...new Set([...existing, nextRoute])].sort());
    if (targetUrl) {
      setReviewedUrl(targetUrl);
      setFrameUrl(targetUrl);
    }
    setCanvas((current) => ({ ...current, pins: current.pins.filter((pin) => pin.pageRoute === nextRoute) }));
    await reloadCanvas(nextRoute);
  }, [initialCanvas.imageSource.kind, reloadCanvas, reviewedUrl, routeDraft]);

  const applyDetectedRoute = useCallback(async (value: string) => {
    if (initialCanvas.imageSource.kind !== "external-url") return;
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    const nextRoute = normalizePageRoute(value);
    activeRoute.current = nextRoute;
    setPageRoute(nextRoute);
    setRouteDraft(value);
    setReviewedUrl(value);
    setRoutes((existing) => [...new Set([...existing, nextRoute])].sort());
    setCanvas((current) => ({ ...current, pins: current.pins.filter((pin) => pin.pageRoute === nextRoute) }));
    await reloadCanvas(nextRoute);
  }, [initialCanvas.imageSource.kind, reloadCanvas]);

  return {
    canvas, pageRoute, routeDraft, routes, sourceUrl, reviewedUrl, frameUrl,
    setRouteDraft, applyRoute, applyDetectedRoute, reloadCanvas,
  };
}
