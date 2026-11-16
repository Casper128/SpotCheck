import { useCallback, useState, type FormEvent } from "react";
import type { Canvas } from "@/domain/entities/Canvas";
import type { Comment } from "@/domain/entities/Comment";
import type { Pin } from "@/domain/entities/Pin";
import type { GuestSession } from "@/presentation/store/reviewStore";
import { requestJson } from "./reviewApi";

export function useCommentThread(options: {
  readonly canvas: Canvas;
  readonly pageRoute: string;
  readonly selectedPin: Pin | null;
  readonly reviewer: GuestSession | null;
  readonly busy: boolean;
  readonly setBusy: (busy: boolean) => void;
  readonly setError: (error: string | null) => void;
  readonly reloadCanvas: () => Promise<Canvas>;
}) {
  const [commentBody, setCommentBody] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);

  const submitComment = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!options.reviewer || !options.selectedPin || !commentBody.trim() || options.busy) return;
    options.setBusy(true);
    options.setError(null);
    try {
      await requestJson<{ readonly comment: Comment }>(
        `/api/canvases/${encodeURIComponent(options.canvas.shareId)}/pins/${encodeURIComponent(options.selectedPin.id)}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            body: commentBody.trim(), pageRoute: options.pageRoute, author: options.reviewer,
            ...(replyToCommentId ? { replyToCommentId } : {}),
          }),
        },
      );
      setCommentBody("");
      setReplyToCommentId(null);
      await options.reloadCanvas();
    } catch (error) {
      options.setError(error instanceof Error ? error.message : "No se pudo enviar el comentario.");
    } finally {
      options.setBusy(false);
    }
  }, [commentBody, options, replyToCommentId]);

  return { commentBody, setCommentBody, replyToCommentId, setReplyToCommentId, submitComment };
}
