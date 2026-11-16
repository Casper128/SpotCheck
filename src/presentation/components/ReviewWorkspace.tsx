"use client";

import { Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Canvas } from "@/domain/entities/Canvas";
import type { Pin } from "@/domain/entities/Pin";
import { FeedbackSidebar } from "@/presentation/components/FeedbackSidebar";
import { GuestReviewerModal } from "@/presentation/components/GuestReviewerModal";
import { ReviewCanvas } from "@/presentation/components/ReviewCanvas";
import { ReviewHeader } from "@/presentation/components/ReviewHeader";
import { ReviewToolbar } from "@/presentation/components/ReviewToolbar";
import { useCanvasNavigation } from "@/presentation/hooks/useCanvasNavigation";
import { useCommentThread } from "@/presentation/hooks/useCommentThread";
import type { InspectorConnection } from "@/presentation/hooks/useDOMInspector";
import { useGuestReviewerSession } from "@/presentation/hooks/useGuestReviewerSession";
import { usePinManager } from "@/presentation/hooks/usePinManager";
import { useReviewStore } from "@/presentation/store/reviewStore";

export default function ReviewWorkspace({ canvas: initialCanvas, proxyOrigin = null }: { readonly canvas: Canvas; readonly proxyOrigin?: string | null }) {
  const navigation = useCanvasNavigation(initialCanvas);
  const { canvas, pageRoute, routeDraft, routes, sourceUrl, reviewedUrl, frameUrl, setRouteDraft, applyRoute } = navigation;
  const [copied, setCopied] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(true);
  const [inspectorConnection, setInspectorConnection] = useState<InspectorConnection>("unsupported");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const placementMode = useReviewStore((state) => state.placementMode);
  const selectedPinId = useReviewStore((state) => state.selectedPinId);
  const filter = useReviewStore((state) => state.filter);
  const setPlacementMode = useReviewStore((state) => state.setPlacementMode);
  const setSelectedPinId = useReviewStore((state) => state.setSelectedPinId);
  const setFilter = useReviewStore((state) => state.setFilter);
  const guest = useGuestReviewerSession(canvas.shareId, setError);
  const imageProject = canvas.imageSource.kind === "uploaded-path";

  useEffect(() => {
    if (imageProject && (placementMode === "element" || placementMode === "container")) {
      setPlacementMode("off");
    } else if (inspectorConnection === "unsupported" && (placementMode === "element" || placementMode === "container")) {
      setPlacementMode("off");
    }
  }, [imageProject, inspectorConnection, placementMode, setPlacementMode]);

  const pins = useMemo(() => [...canvas.pins].sort((a, b) => a.pinNumber - b.pinNumber), [canvas.pins]);
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null;
  const pinManager = usePinManager({
    canvas, pageRoute, reviewedUrl, reviewer: guest.reviewer, surfaceRef, busy, setBusy, setError,
    reloadCanvas: navigation.reloadCanvas, setFilter, setSelectedPinId, setPlacementMode,
  });
  const thread = useCommentThread({
    canvas, pageRoute, selectedPin, reviewer: guest.reviewer, busy, setBusy, setError,
    reloadCanvas: navigation.reloadCanvas,
  });

  async function changeRoute(value = routeDraft) {
    setSelectedPinId(null);
    setPlacementMode("off");
    thread.setReplyToCommentId(null);
    thread.setCommentBody("");
    try {
      await applyRoute(value);
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "No se pudo cargar esta página.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No se pudo copiar el enlace. Comprueba los permisos del portapapeles.");
    }
  }

  function choosePin(pin: Pin) {
    setFilter(pin.status);
    setSelectedPinId(pin.id);
  }

  function resolvePin(pin: Pin) {
    void pinManager.resolvePin(pin, () => {
      setSelectedPinId(null);
      setFilter("open");
      setNotice(`Punto #${pin.pinNumber} marcado como resuelto.`);
      window.setTimeout(() => setNotice(null), 2400);
    });
  }

  return (
    <main className="review-shell">
      <ReviewHeader
        canvas={canvas}
        reviewedUrl={reviewedUrl}
        reviewer={guest.reviewer}
        copied={copied}
        onCopy={() => void copyLink()}
        onChangeReviewer={guest.changeReviewer}
      />
      <ReviewToolbar
        canvas={canvas}
        placementMode={placementMode}
        inspectorAvailable={inspectorConnection === "connected"}
        feedbackVisible={feedbackVisible}
        onShowFeedback={() => setFeedbackVisible(true)}
        onPlacementModeChange={(mode) => { setSelectedPinId(null); setPlacementMode(mode); }}
      />
      <div className="review-body">
        <ReviewCanvas
          canvas={canvas}
          proxyOrigin={proxyOrigin}
          sourceUrl={sourceUrl}
          frameUrl={frameUrl}
          pageRoute={pageRoute}
          routeDraft={routeDraft}
          routes={routes}
          reviewedUrl={reviewedUrl}
          placementMode={placementMode}
          selectedPinId={selectedPinId}
          pins={pins}
          surfaceRef={surfaceRef}
          onRouteDraftChange={setRouteDraft}
          onRouteChange={(route) => void changeRoute(route)}
          onAddPin={(event) => pinManager.addPin(event)}
          onAddAnchoredPin={(point) => pinManager.addPinAt(point)}
          onAddFreePoint={(point) => pinManager.addPinAt(point)}
          onInspectorConnectionChange={setInspectorConnection}
          onDetectedRoute={(href) => {
            void navigation.applyDetectedRoute(href).catch((routeError: unknown) => {
              setError(routeError instanceof Error ? routeError.message : "No se pudo detectar la ruta actual.");
            });
          }}
          onSelectPin={choosePin}
          onError={setError}
        />
        {feedbackVisible && <FeedbackSidebar
          pins={pins}
          filter={filter}
          selectedPinId={selectedPinId}
          reviewer={guest.reviewer}
          busy={busy}
          commentBody={thread.commentBody}
          replyToCommentId={thread.replyToCommentId}
          onFilterChange={setFilter}
          onClearSelection={() => setSelectedPinId(null)}
          onClose={() => { setSelectedPinId(null); setFeedbackVisible(false); }}
          onSelectPin={choosePin}
          onFreePointEnabled={() => setPlacementMode("free")}
          onCommentBodyChange={thread.setCommentBody}
          onReplyToCommentChange={thread.setReplyToCommentId}
          onSubmitComment={thread.submitComment}
          onResolvePin={resolvePin}
        />}
      </div>
      {error && <div className="review-toast review-toast-error" role="alert"><span>{error}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setError(null)}><X size={14} /></button></div>}
      {notice && <div className="review-toast review-toast-success" role="status"><Check size={14} />{notice}</div>}
      {guest.reviewerReady && !guest.reviewer && (
        <GuestReviewerModal
          name={guest.reviewerName}
          inputRef={guest.inputRef}
          onNameChange={guest.setReviewerName}
          onSubmit={guest.rememberReviewer}
        />
      )}
    </main>
  );
}
