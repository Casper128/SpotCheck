import { useCallback, useState, type FormEvent } from "react";
import type { Canvas } from "@/domain/types";
import type { Pin } from "@/domain/types";
import type { GuestSession } from "@/presentation/store/reviewStore";
import { workspaceService } from "@/presentation/dependencies";

export function useCommentThread(options: {
  readonly canvas: Canvas;
  readonly pageRoute: string;
  readonly selectedPin: Pin | null;
  readonly reviewer: GuestSession | null;
  readonly busy: boolean;
  readonly setBusy: (busy: boolean) => void;
  readonly setError: (error: string | null) => void;
}) {
  const [commentBody, setCommentBody] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);

  const submitComment = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!options.reviewer || !options.selectedPin || !commentBody.trim() || options.busy) return;
    options.setBusy(true);
    options.setError(null);
    try {
      await workspaceService.addComment(options.canvas.shareId, options.selectedPin.id, {
        body: commentBody.trim(), pageRoute: options.pageRoute, author: options.reviewer,
        ...(replyToCommentId ? { replyToCommentId } : {}),
      });
      setCommentBody("");
      setReplyToCommentId(null);
    } catch (error) {
      options.setError(error instanceof Error ? error.message : "No se pudo enviar el comentario.");
    } finally {
      options.setBusy(false);
    }
  }, [commentBody, options, replyToCommentId]);

  return { commentBody, setCommentBody, replyToCommentId, setReplyToCommentId, submitComment };
}
