"use client";
/* eslint-disable @next/next/no-img-element -- Intrinsic image bounds must match the pin coordinate overlay. */

import { ArrowUpRight, CircleHelp, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useSyncExternalStore, useState, type MouseEvent, type RefObject } from "react";
import type { Canvas } from "@/domain/entities/Canvas";
import type { Pin } from "@/domain/entities/Pin";
import { PinMarker } from "@/presentation/components/PinThread";
import { useDOMInspector } from "@/presentation/hooks/useDOMInspector";
import type { AnchoredPinPoint, FreePinPoint, InspectorConnection } from "@/presentation/hooks/useDOMInspector";
import { proxyFrameUrl, reviewedProxyUrl } from "@/presentation/reviewProxy";
import type { PinPlacementMode } from "@/presentation/domInspectorProtocol";

export function ReviewCanvas({
  canvas,
  proxyOrigin,
  sourceUrl,
  frameUrl,
  pageRoute,
  routeDraft,
  routes,
  reviewedUrl,
  placementMode,
  selectedPinId,
  pins,
  surfaceRef,
  onRouteDraftChange,
  onRouteChange,
  onAddPin,
  onAddAnchoredPin,
  onAddFreePoint,
  onInspectorConnectionChange,
  onDetectedRoute,
  onSelectPin,
  onError,
}: {
  readonly canvas: Canvas;
  readonly proxyOrigin: string | null;
  readonly sourceUrl: string;
  readonly frameUrl: string;
  readonly pageRoute: string;
  readonly routeDraft: string;
  readonly routes: readonly string[];
  readonly reviewedUrl: string;
  readonly placementMode: PinPlacementMode;
  readonly selectedPinId: string | null;
  readonly pins: readonly Pin[];
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly onRouteDraftChange: (value: string) => void;
  readonly onRouteChange: (value?: string) => void;
  readonly onAddPin: (event: MouseEvent<HTMLDivElement>) => void | Promise<void>;
  readonly onAddAnchoredPin: (point: AnchoredPinPoint) => void | Promise<void>;
  readonly onAddFreePoint: (point: FreePinPoint) => void | Promise<void>;
  readonly onInspectorConnectionChange: (connection: InspectorConnection) => void;
  readonly onDetectedRoute: (href: string) => void;
  readonly onSelectPin: (pin: Pin) => void;
  readonly onError: (message: string) => void;
}) {
  const imageProject = canvas.imageSource.kind === "uploaded-path";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const appOrigin = useSyncExternalStore(subscribeNoop, getAppOrigin, getServerAppOrigin);
  const [useProxy, setUseProxy] = useState(Boolean(proxyOrigin));
  const activeProxyOrigin = useProxy ? proxyOrigin : null;
  const inspectorFrameUrl = proxyFrameUrl(frameUrl, activeProxyOrigin);
  const originalHref = useCallback((href: string) => reviewedProxyUrl(href, activeProxyOrigin), [activeProxyOrigin]);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const anchorClick = useCallback((point: AnchoredPinPoint) => {
    if (placementMode === "element" || placementMode === "container") void onAddAnchoredPin({ ...point, reviewedUrl: originalHref(point.reviewedUrl) });
  }, [onAddAnchoredPin, placementMode, originalHref]);
  const freePoint = useCallback((point: FreePinPoint) => {
    if (placementMode === "free") void onAddFreePoint({ ...point, reviewedUrl: originalHref(point.reviewedUrl) });
  }, [onAddFreePoint, placementMode, originalHref]);
  const inspector = useDOMInspector({
    iframeRef,
    mode: placementMode,
    pins,
    frameUrl: inspectorFrameUrl,
    onAnchorClick: anchorClick,
    onFreePoint: freePoint,
    onRouteChange: (href) => {
      try { onDetectedRoute(originalHref(href)); } catch { onError("No se pudo interpretar la ruta del proxy."); }
    },
  });
  useEffect(() => onInspectorConnectionChange(inspector.connection), [inspector.connection, onInspectorConnectionChange]);
  const installationSnippet = (() => {
    if (!appOrigin) return "";
    let host = "";
    try { host = new URL(reviewedUrl).hostname; } catch { return ""; }
    return `<script src="${appOrigin}/spotcheck-inspector.js" data-parent-origin="${appOrigin}" data-allowed-hosts="${host}" defer></script>`;
  })();
  const inspectorMode = placementMode === "element" || placementMode === "container";
  const parentCapturesClicks = placementMode === "free"
    ? inspector.connection !== "connected"
    : inspectorMode && inspector.connection !== "connected";

  async function copyInstallationSnippet() {
    try {
      await navigator.clipboard.writeText(installationSnippet);
      setCopiedSnippet(true);
    } catch {
      onError("No se pudo copiar el snippet; selecciónalo y cópialo manualmente.");
    }
  }

  useEffect(() => {
    if (!selectedPinId) return;
    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById(`pin-${selectedPinId}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [selectedPinId, pins]);

  return (
    <section className="viewer-column" aria-label="Visor de revisión">
      <div className="viewer-stage">
        <div className="viewer-stage-label"><span>CANVAS</span><span>·</span><span>{canvas.browserMetadata.viewportWidth} × {canvas.browserMetadata.viewportHeight}</span></div>
        <div className="route-selector">
          <label htmlFor="review-route">Página revisada</label>
          <select
            id="review-route"
            aria-label="Elegir una ruta observada"
            value={routes.includes(pageRoute) ? pageRoute : ""}
            disabled={imageProject}
            onChange={(event) => onRouteChange(event.target.value)}
          >
            {routes.map((route) => <option key={route} value={route}>{route}</option>)}
          </select>
          <form onSubmit={(event) => { event.preventDefault(); onRouteChange(); }}>
            <input
              aria-label="URL o ruta de página"
              value={routeDraft}
              disabled={imageProject}
              onChange={(event) => onRouteDraftChange(event.target.value)}
            />
            <button type="submit" disabled={imageProject}>Ir</button>
          </form>
        </div>
        <div className="viewer-content">
          {imageProject ? (
            <div className="image-canvas-wrap">
              <img className="review-image" src={sourceUrl} alt={canvas.browserMetadata.pageTitle} onError={() => onError("No se pudo cargar la imagen de este proyecto.")} />
              <div
                className={placementMode === "free" ? "pin-capture-layer pin-capture-active" : "pin-capture-layer"}
                ref={surfaceRef}
                onClick={(event) => { if (placementMode === "free") void onAddPin(event); }}
                aria-label={placementMode === "free" ? "Haz clic en la imagen para colocar un punto libre" : undefined}
              >
                {pins.map((pin) => <PinMarker key={pin.id} pin={pin} number={pin.pinNumber} selected={selectedPinId === pin.id} onSelect={() => onSelectPin(pin)} />)}
              </div>
            </div>
          ) : (
            <div className="web-canvas-wrap">
              {appOrigin && (
                <iframe
                  className="review-iframe"
                  ref={iframeRef}
                  title={`Vista de revisión de ${canvas.browserMetadata.pageTitle}`}
                  sandbox={getIframeSandbox(inspectorFrameUrl, appOrigin)}
                  src={inspectorFrameUrl}
                  referrerPolicy="no-referrer"
                  onLoad={inspector.onLoad}
                />
              )}
              <div
                className={placementMode === "off"
                  ? "pin-capture-layer"
                  : parentCapturesClicks
                    ? "pin-capture-layer pin-capture-active"
                    : `pin-capture-layer ${inspector.connection === "connected" ? "pin-capture-bridge" : ""}`}
                ref={surfaceRef}
                onClick={(event) => {
                  if (placementMode === "free" && inspector.connection !== "connected") void onAddPin(event);
                }}
                aria-label={placementMode === "free"
                  ? "Haz clic en la página para colocar un punto libre"
                  : inspectorMode
                    ? "Haz clic en un elemento de la página para seleccionarlo"
                    : undefined}
              >
                {pins.map((pin) => <PinMarker key={pin.id} pin={pin} number={pin.pinNumber} selected={selectedPinId === pin.id} position={inspector.livePositions.get(pin.id)} anchorMissing={Boolean(pin.domAnchor && (inspector.connection !== "connected" || inspector.missingAnchors.has(pin.id)))} onSelect={() => onSelectPin(pin)} />)}
              </div>
              {placementMode === "container" && inspector.connection === "connected" && inspector.hoverCandidates.length > 1 && (
                <label className="container-candidate-picker">
                  Elegir contenedor
                  <select
                    aria-label="Elegir elemento contenedor"
                    value={inspector.selectedContainerSelector}
                    onChange={(event) => inspector.selectContainerCandidate(event.target.value)}
                  >
                    {inspector.hoverCandidates.map((candidate) => (
                      <option key={candidate.selector} value={candidate.selector}>{candidate.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
        {!imageProject && <>
          {proxyOrigin && <label className="iframe-hint">
            <input type="checkbox" checked={useProxy} onChange={(event) => setUseProxy(event.target.checked)} />
            Revisar mediante proxy · inspector sin instalar el snippet
          </label>}
          {useProxy && proxyOrigin && <p className="iframe-hint">Vista de páginas públicas. Algunos sitios con sesión o aplicaciones dinámicas requieren la integración directa.</p>}
          <div className="iframe-hint"><CircleHelp size={13} />
            {inspector.connection === "connected"
              ? "Integración activa: los anclajes DOM y puntos libres con scroll siguen el contenido."
              : inspector.connection === "connecting"
                ? "Conectando con el script del sitio; si no responde, Punto libre será relativo al viewport."
                : "Sin integración, Punto libre usa coordenadas del viewport y no sigue el scroll interno."}
            <a href={reviewedUrl} target="_blank" rel="noreferrer">Ábrelo en otra pestaña <ArrowUpRight size={11} /></a>
          </div>
          <details className="inspector-install">
            <summary>Integración del sitio · {inspector.connection === "connected" ? "conectada" : inspector.connection === "connecting" ? "conectando…" : "no detectada"}</summary>
            <p>El propietario del sitio debe añadir este script antes de <code>&lt;/body&gt;</code>. SpotCheck no puede inspeccionar el DOM de un iframe externo sin esa integración.</p>
            <textarea aria-label="Snippet de instalación del inspector" readOnly value={installationSnippet} rows={2} />
            <button type="button" disabled={!installationSnippet} onClick={() => void copyInstallationSnippet()}>{copiedSnippet ? "Copiado" : "Copiar snippet"}</button>
            {inspector.connection === "connected"
              ? <small>El sitio coopera con SpotCheck: selección DOM y detección automática de rutas activas.</small>
              : inspector.connection === "connecting"
                ? <small>Esperando la confirmación del script. Si no se detecta, solo estará disponible Punto libre en coordenadas del viewport.</small>
                : <small>La página permanece aislada por seguridad. Punto libre no seguirá el scroll interno; para anclar elementos y detectar rutas necesitas la integración.</small>}
          </details>
        </>}
        {placementMode !== "off" && <div className="pin-mode-tip"><Plus size={13} />
          {placementMode === "element" && "Haz clic para anclar el elemento DOM más profundo."}
          {placementMode === "container" && inspector.hoverCandidates.length > 1 && "Elige un contenedor arriba y haz clic para anclarlo."}
          {placementMode === "container" && inspector.hoverCandidates.length <= 1 && "Pasa el cursor por un contenedor; puedes elegirlo o cambiar a Punto libre."}
          {placementMode === "free" && "Haz clic para colocar un punto libre, sin selector DOM."}
          {inspectorMode && inspector.connection === "connecting" && " Esperando la conexión del script del sitio."}
          {inspectorMode && inspector.connection === "unsupported" && " Integra el script del sitio para seleccionar elementos."}
          {placementMode === "free" && !imageProject && inspector.connection !== "connected" && " Sin integración, la coordenada puede desviarse del contenido al desplazar el iframe."}
        </div>}
      </div>
    </section>
  );
}

function subscribeNoop(): () => void {
  return () => undefined;
}

function getAppOrigin(): string {
  return window.location.origin;
}

function getServerAppOrigin(): string {
  return "";
}

function getIframeSandbox(frameUrl: string, appOrigin: string): string {
  try {
    const target = new URL(frameUrl);
    if (appOrigin && target.origin !== appOrigin) {
      return "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
    }
  } catch {
    return "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";
  }
  return "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";
}
