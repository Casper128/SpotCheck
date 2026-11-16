import { useEffect, useRef, useState, type FormEvent } from "react";
import { useReviewStore, type GuestSession } from "@/presentation/store/reviewStore";

function getStorageKey(shareId: string): string {
  return `pastel:reviewer:${shareId}`;
}

export function useGuestReviewerSession(shareId: string, setError: (message: string | null) => void) {
  const [reviewerReady, setReviewerReady] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewer = useReviewStore((state) => state.reviewer);
  const setReviewer = useReviewStore((state) => state.setReviewer);
  const clearReviewer = useReviewStore((state) => state.clearReviewer);
  const setSelectedPinId = useReviewStore((state) => state.setSelectedPinId);
  const setPlacementMode = useReviewStore((state) => state.setPlacementMode);

  useEffect(() => {
    clearReviewer();
    setSelectedPinId(null);
    setPlacementMode("off");
    let storageError: string | null = null;
    try {
      const saved = window.localStorage.getItem(getStorageKey(shareId));
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "id" in parsed &&
          "displayName" in parsed &&
          typeof parsed.id === "string" &&
          typeof parsed.displayName === "string"
        ) {
          setReviewer({ id: parsed.id, displayName: parsed.displayName });
        }
      }
    } catch (error) {
      console.error("Could not read the saved reviewer session:", error);
      storageError = "No se pudo leer la sesión de revisor guardada en este navegador.";
    }
    const timer = window.setTimeout(() => {
      if (storageError) setError(storageError);
      setReviewerReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clearReviewer, setPlacementMode, setError, setReviewer, setSelectedPinId, shareId]);

  useEffect(() => {
    if (reviewerReady && !reviewer) inputRef.current?.focus();
  }, [reviewerReady, reviewer]);

  function rememberReviewer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = reviewerName.trim();
    if (!displayName) {
      inputRef.current?.focus();
      return;
    }
    const session: GuestSession = { id: crypto.randomUUID(), displayName };
    try {
      window.localStorage.setItem(getStorageKey(shareId), JSON.stringify(session));
      setReviewer(session);
      setError(null);
    } catch (error) {
      console.error("Could not save the reviewer session:", error);
      setError("No se pudo guardar tu nombre en este navegador. Revisa el almacenamiento y vuelve a intentarlo.");
    }
  }

  function changeReviewer() {
    clearReviewer();
    setReviewerName("");
  }

  return {
    reviewer,
    reviewerReady,
    reviewerName,
    setReviewerName,
    inputRef,
    rememberReviewer,
    changeReviewer,
  };
}
