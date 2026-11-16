import { CheckCheck, Globe, LoaderCircle, Send } from "lucide-react";
import type { FormEvent } from "react";
import type { Pin } from "@/domain/entities/Pin";
import type { GuestSession } from "@/presentation/store/reviewStore";

export function PinMarker({
  pin,
  number,
  selected,
  position,
  anchorMissing = false,
  onSelect,
}: {
  readonly pin: Pin;
  readonly number: number;
  readonly selected: boolean;
  readonly position?: { readonly x: number; readonly y: number };
  readonly anchorMissing?: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      className={`pin-marker${pin.status === "resolved" ? " pin-marker-resolved" : ""}${selected ? " pin-marker-selected" : ""}${anchorMissing ? " pin-marker-anchor-missing" : ""}`}
      id={`pin-${pin.id}`}
      style={{ left: `${(position?.x ?? pin.x) * 100}%`, top: `${(position?.y ?? pin.y) * 100}%` }}
      title={anchorMissing ? "No se encontró el elemento; se muestra la posición guardada." : undefined}
      type="button"
      aria-label={`Punto ${number}${pin.status === "resolved" ? ", resuelto" : ""}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      {number}
    </button>
  );
}

export function PinThread({
  pin,
  number,
  reviewer,
  busy,
  commentBody,
  setCommentBody,
  replyToCommentId,
  setReplyToCommentId,
  onSubmit,
  onResolve,
}: {
  readonly pin: Pin;
  readonly number: number;
  readonly reviewer: GuestSession | null;
  readonly busy: boolean;
  readonly commentBody: string;
  readonly setCommentBody: (value: string) => void;
  readonly replyToCommentId: string | null;
  readonly setReplyToCommentId: (value: string | null) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onResolve: () => void;
}) {
  return (
    <div className="pin-discussion">
      <div className="discussion-meta"><span><Globe size={11} /> {pin.snapshot.browser.name} · {pin.snapshot.operatingSystem.name}</span><span>{Math.round(pin.snapshot.viewport.width)} × {Math.round(pin.snapshot.viewport.height)}</span></div>
      <a className="discussion-url" href={pin.snapshot.reviewedUrl} target="_blank" rel="noreferrer" title={pin.snapshot.reviewedUrl}>{pin.snapshot.reviewedUrl}</a>
      <div className="discussion-comments">
        {pin.comments.length === 0 ? <p className="no-comments">Deja el primer comentario en este punto.</p> : pin.comments.map((comment) => (
          <div className={comment.replyToCommentId ? "thread-comment thread-reply" : "thread-comment"} key={comment.id}>
            <div className="thread-comment-top"><span className="thread-avatar">{comment.author.displayName.slice(0, 1).toUpperCase()}</span><strong>{comment.author.displayName}</strong><time>{formatDate(comment.createdAt)}</time></div>
            <p>{comment.body}</p>
            {pin.status === "open" && <button className="reply-link" type="button" onClick={() => setReplyToCommentId(comment.id)}>Responder</button>}
          </div>
        ))}
      </div>
      {pin.status === "open" ? (
        <form className="reply-form" onSubmit={onSubmit}>
          {replyToCommentId && <div className="replying-to">Respondiendo en el hilo <button type="button" onClick={() => setReplyToCommentId(null)}>Cancelar</button></div>}
          <textarea aria-label="Escribe un comentario" placeholder={replyToCommentId ? "Escribe tu respuesta..." : "Escribe un comentario..."} maxLength={5000} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} />
          <div className="reply-form-bottom"><span>{reviewer?.displayName} · {commentBody.length}/5000</span><button className="send-comment" type="submit" disabled={busy || !commentBody.trim()} aria-label="Enviar comentario">{busy ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}</button></div>
        </form>
      ) : (
        <div className="resolved-note"><CheckCheck size={14} /> Resuelto por {pin.resolvedBy?.displayName ?? "un revisor"}</div>
      )}
      {pin.status === "open" && <button className="resolve-button" type="button" onClick={onResolve} disabled={busy}><CheckCheck size={14} /> Marcar punto #{number} como resuelto</button>}
    </div>
  );
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
