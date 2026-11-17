import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { DOMAnchor, Pin } from "@/domain/types";
import {
  DOM_INSPECTOR_PROTOCOL,
  DOM_INSPECTOR_VERSION,
  MAX_INSPECTOR_PINS,
  getInspectorPlacementAction,
  isTrustedInspectorEvent,
  normalizeViewportPoint,
} from "@/presentation/domInspectorProtocol";
import type { InspectorCandidate, PinPlacementMode } from "@/presentation/domInspectorProtocol";

export interface AnchoredPinPoint {
  readonly x: number;
  readonly y: number;
  readonly domAnchor: DOMAnchor;
  readonly reviewedUrl: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly scrollOffset: { readonly x: number; readonly y: number };
}

export interface FreePinPoint {
  readonly x: number;
  readonly y: number;
  readonly reviewedUrl: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly scrollOffset: { readonly x: number; readonly y: number };
}

export type InspectorConnection = "unsupported" | "connecting" | "connected";

export function useDOMInspector(options: {
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly mode: PinPlacementMode;
  readonly pins: readonly Pin[];
  readonly frameUrl: string;
  readonly onAnchorClick: (point: AnchoredPinPoint) => void;
  readonly onFreePoint: (point: FreePinPoint) => void;
  readonly onRouteChange: (href: string) => void;
}) {
  const [connection, setConnection] = useState<InspectorConnection>("unsupported");
  const [livePositions, setLivePositions] = useState<ReadonlyMap<string, { readonly x: number; readonly y: number }>>(() => new Map());
  const [missingAnchors, setMissingAnchors] = useState<ReadonlySet<string>>(() => new Set());
  const [hoverState, setHoverState] = useState<{
    readonly mode: PinPlacementMode;
    readonly candidates: readonly InspectorCandidate[];
    readonly selectedSelector: string;
  }>({ mode: "off", candidates: [], selectedSelector: "" });
  const hoverCandidates = useMemo(
    () => hoverState.mode === options.mode ? hoverState.candidates : [],
    [hoverState, options.mode],
  );
  const selectedContainerSelector = hoverState.mode === options.mode ? hoverState.selectedSelector : "";
  const [frameLoad, setFrameLoad] = useState(0);
  const nonceRef = useRef("");
  const readyRef = useRef(false);
  const modeRef = useRef(options.mode);
  const containerCandidateRef = useRef("");
  const activeHrefRef = useRef("");
  const loadedFrameUrlRef = useRef("");
  const callbacksRef = useRef({
    onAnchorClick: options.onAnchorClick,
    onFreePoint: options.onFreePoint,
    onRouteChange: options.onRouteChange,
  });
  const pinsRef = useRef(options.pins);

  const onLoad = useCallback(() => {
    setFrameLoad((value) => value + 1);
    loadedFrameUrlRef.current = options.frameUrl;
    nonceRef.current = "";
    readyRef.current = false;
    activeHrefRef.current = "";
    setHoverState({ mode: options.mode, candidates: [], selectedSelector: "" });
    let targetOrigin = "";
    try { targetOrigin = new URL(options.frameUrl).origin; } catch { /* Invalid URLs stay unsupported. */ }
    setConnection(targetOrigin && targetOrigin !== "null" && targetOrigin !== window.location.origin ? "connecting" : "unsupported");
    setLivePositions(new Map());
    setMissingAnchors(new Set());
  }, [options.frameUrl, options.mode]);

  useEffect(() => {
    callbacksRef.current = {
      onAnchorClick: options.onAnchorClick,
      onFreePoint: options.onFreePoint,
      onRouteChange: options.onRouteChange,
    };
    pinsRef.current = options.pins;
  }, [options.onAnchorClick, options.onFreePoint, options.onRouteChange, options.pins]);

  useEffect(() => {
    modeRef.current = options.mode;
    if (options.mode !== "container") {
      containerCandidateRef.current = "";
    }
  }, [options.mode]);

  const selectContainerCandidate = useCallback((selector: string) => {
    if (modeRef.current !== "container" || !hoverCandidates.some((candidate) => candidate.selector === selector)) return;
    containerCandidateRef.current = selector;
    setHoverState((current) => current.mode === "container" ? { ...current, selectedSelector: selector } : current);
    const iframe = options.iframeRef.current;
    const frameWindow = iframe?.contentWindow;
    const nonce = nonceRef.current;
    if (!frameWindow || !nonce || !readyRef.current) return;
    try {
      frameWindow.postMessage({
        protocol: DOM_INSPECTOR_PROTOCOL,
        version: DOM_INSPECTOR_VERSION,
        nonce,
        type: "candidate",
        selector,
      }, new URL(options.frameUrl).origin);
    } catch {
      // The current frame URL can change while a candidate is being chosen.
    }
  }, [hoverCandidates, options.frameUrl, options.iframeRef]);

  useEffect(() => {
    if (frameLoad === 0 || loadedFrameUrlRef.current !== options.frameUrl) return;
    const iframe = options.iframeRef.current;
    const frameWindow = iframe?.contentWindow;
    if (!iframe || !frameWindow) return;
    let targetOrigin: string;
    try {
      targetOrigin = new URL(options.frameUrl).origin;
      if (targetOrigin === "null") throw new Error("Opaque origin");
      if (targetOrigin === window.location.origin) return;
    } catch {
      return;
    }

    const nonce = window.crypto.randomUUID();
    nonceRef.current = nonce;
    readyRef.current = false;
    let retryTimer = 0;
    const listener = (event: MessageEvent<unknown>) => {
      if (nonceRef.current !== nonce) return;
      if (!isTrustedInspectorEvent(event, frameWindow, targetOrigin, nonce, window.location.origin)) return;
      const message = event.data;
      if (message.type === "ready") {
        if (!matchesOrigin(message.href, targetOrigin)) return;
        readyRef.current = true;
        window.clearInterval(retryTimer);
        activeHrefRef.current = message.href;
        setConnection("connected");
        callbacksRef.current.onRouteChange(message.href);
      } else if (message.type === "route") {
        if (!matchesOrigin(message.href, targetOrigin)) return;
        activeHrefRef.current = message.href;
        callbacksRef.current.onRouteChange(message.href);
      } else if (message.type === "hover") {
        if (message.mode !== modeRef.current) return;
        containerCandidateRef.current = message.selectedSelector;
        setHoverState({
          mode: message.mode,
          candidates: message.candidates,
          selectedSelector: message.selectedSelector,
        });
      } else if (message.type === "selected" || message.type === "point") {
        if (!matchesOrigin(message.href, targetOrigin) || message.href !== activeHrefRef.current) return;
        const action = getInspectorPlacementAction(message, modeRef.current);
        if (!action || iframe.clientWidth <= 0 || iframe.clientHeight <= 0) return;
        const point = normalizeViewportPoint(
          action.message.pointX,
          action.message.pointY,
          action.message.viewportWidth,
          action.message.viewportHeight,
        );
        const placement = {
          ...point,
          reviewedUrl: action.message.href,
          viewport: { width: action.message.viewportWidth, height: action.message.viewportHeight },
          scrollOffset: { x: action.message.scrollX, y: action.message.scrollY },
        };
        if (action.type === "anchor") {
          callbacksRef.current.onAnchorClick({ ...placement, domAnchor: action.message.anchor });
        } else {
          callbacksRef.current.onFreePoint(placement);
        }
      } else if (message.type === "positions") {
        const bounds = iframe.getBoundingClientRect();
        if (!iframe.clientWidth || !iframe.clientHeight || !bounds.width || !bounds.height) return;
        const positions = new Map<string, { x: number; y: number }>();
        const missing = new Set(message.missing);
        for (const item of message.positions) {
          const anchor = pinsRef.current.find((pin) => pin.id === item.id)?.domAnchor;
          const pointX = item.rect.left + item.rect.width * (anchor?.offsetX ?? 0.5);
          const pointY = item.rect.top + item.rect.height * (anchor?.offsetY ?? 0.5);
          positions.set(item.id, normalizeViewportPoint(
            pointX,
            pointY,
            item.viewportWidth,
            item.viewportHeight,
          ));
        }
        for (const pin of pinsRef.current) {
          if (pin.domAnchor && !missing.has(pin.id)) continue;
          positions.set(pin.id, normalizeViewportPoint(
            pin.x * pin.snapshot.viewport.width + (pin.snapshot.scrollOffset?.x ?? 0) - message.scrollX,
            pin.y * pin.snapshot.viewport.height + (pin.snapshot.scrollOffset?.y ?? 0) - message.scrollY,
            message.viewportWidth,
            message.viewportHeight,
          ));
        }
        setLivePositions(positions);
        setMissingAnchors(missing);
      }
    };
    window.addEventListener("message", listener);
    const sendStart = () => frameWindow.postMessage({
      protocol: DOM_INSPECTOR_PROTOCOL,
      version: DOM_INSPECTOR_VERSION,
      type: "start",
      nonce,
    }, targetOrigin);
    sendStart();
    retryTimer = window.setInterval(() => {
      if (readyRef.current) window.clearInterval(retryTimer);
      else sendStart();
    }, 200);
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) {
        window.clearInterval(retryTimer);
        setConnection("unsupported");
      }
    }, 3500);
    return () => {
      window.removeEventListener("message", listener);
      window.clearInterval(retryTimer);
      window.clearTimeout(timeout);
      readyRef.current = false;
      nonceRef.current = "";
    };
  }, [options.iframeRef, options.frameUrl, frameLoad]);

  useEffect(() => {
    if (frameLoad === 0 || loadedFrameUrlRef.current !== options.frameUrl) return;
    const iframe = options.iframeRef.current;
    const frameWindow = iframe?.contentWindow;
    const nonce = nonceRef.current;
    if (!frameWindow || !nonce || !readyRef.current) return;
    let targetOrigin: string;
    try {
      targetOrigin = new URL(options.frameUrl).origin;
    } catch {
      return;
    }
    frameWindow.postMessage({
      protocol: DOM_INSPECTOR_PROTOCOL,
      version: DOM_INSPECTOR_VERSION,
      nonce,
      type: "inspection",
      mode: options.mode,
    }, targetOrigin);
    frameWindow.postMessage({
      protocol: DOM_INSPECTOR_PROTOCOL,
      version: DOM_INSPECTOR_VERSION,
      nonce,
      type: "anchors",
      pins: options.pins.filter((pin) => pin.domAnchor).slice(0, MAX_INSPECTOR_PINS).map((pin) => ({
        id: pin.id,
        selector: pin.domAnchor!.selector,
        offsetX: pin.domAnchor!.offsetX,
        offsetY: pin.domAnchor!.offsetY,
      })),
    }, targetOrigin);
  }, [options.iframeRef, options.frameUrl, options.mode, options.pins, connection, frameLoad]);

  return {
    connection,
    livePositions,
    missingAnchors,
    hoverCandidates,
    selectedContainerSelector,
    selectContainerCandidate,
    onLoad,
  };
}

function matchesOrigin(href: string, origin: string): boolean {
  try {
    return new URL(href).origin === origin;
  } catch {
    return false;
  }
}
