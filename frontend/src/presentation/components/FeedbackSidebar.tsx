import { CheckCheck, MessageCircle, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import type { Pin } from "@/domain/types";
import { formatDate, PinThread } from "@/presentation/components/PinThread";
import type { GuestSession, PinFilter } from "@/presentation/store/reviewStore";

export function FeedbackSidebar({
  pins,
  filter,
  selectedPinId,
  reviewer,
  busy,
  commentBody,
  replyToCommentId,
  onFilterChange,
  onClearSelection,
  onClose,
  onSelectPin,
  onFreePointEnabled,
  onCommentBodyChange,
  onReplyToCommentChange,
  onSubmitComment,
  onResolvePin,
}: {
  readonly pins: readonly Pin[];
  readonly filter: PinFilter;
  readonly selectedPinId: string | null;
  readonly reviewer: GuestSession | null;
  readonly busy: boolean;
  readonly commentBody: string;
  readonly replyToCommentId: string | null;
  readonly onFilterChange: (filter: PinFilter) => void;
  readonly onClearSelection: () => void;
  readonly onClose: () => void;
  readonly onSelectPin: (pin: Pin) => void;
  readonly onFreePointEnabled: () => void;
  readonly onCommentBodyChange: (value: string) => void;
  readonly onReplyToCommentChange: (value: string | null) => void;
  readonly onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  readonly onResolvePin: (pin: Pin) => void;
}) {
  const openPins = pins.filter((pin) => pin.status === "open");
  const resolvedPins = pins.filter((pin) => pin.status === "resolved");
  const visiblePins = filter === "open" ? openPins : resolvedPins;

  return (
    <aside id="feedback-sidebar" className="comments-sidebar" aria-label="Comentarios">
      <div className="sidebar-heading">
        <div><div className="sidebar-title-row"><h2>Feedback</h2><span className="feedback-total">{pins.length}</span></div><p>Comentarios sobre este proyecto</p></div>
        <button className="sidebar-close" type="button" aria-label="Cerrar panel" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="filter-tabs" role="tablist" aria-label="Filtrar puntos">
        <button type="button" role="tab" aria-selected={filter === "open"} className={filter === "open" ? "filter-tab filter-tab-active" : "filter-tab"} onClick={() => { onClearSelection(); onFilterChange("open"); }}>Pendientes <span>{openPins.length}</span></button>
        <button type="button" role="tab" aria-selected={filter === "resolved"} className={filter === "resolved" ? "filter-tab filter-tab-active" : "filter-tab"} onClick={() => { onClearSelection(); onFilterChange("resolved"); }}>Resueltos <span>{resolvedPins.length}</span></button>
      </div>
      <div className="feedback-list">
        {visiblePins.length === 0 ? (
          <div className="feedback-empty">
            <span className="feedback-empty-icon">{filter === "open" ? <MessageCircle size={17} /> : <CheckCheck size={17} />}</span>
            <strong>{filter === "open" ? "Todo está en calma" : "Nada resuelto todavía"}</strong>
            <span>{filter === "open" ? "Usa Punto libre para colocar una ubicación y comenzar la conversación." : "Los puntos resueltos aparecerán aquí."}</span>
            {filter === "open" && <button className="empty-comment-button" type="button" onClick={onFreePointEnabled}><Plus size={13} /> Añadir un comentario</button>}
          </div>
        ) : visiblePins.map((pin) => (
          <article className={selectedPinId === pin.id ? "feedback-card feedback-card-selected" : "feedback-card"} key={pin.id}>
            <button type="button" className="feedback-card-head" onClick={() => onSelectPin(pin)}>
              <span className={pin.status === "resolved" ? "pin-number pin-number-resolved" : "pin-number"}>{pin.pinNumber}</span>
              <span className="feedback-card-author">{pin.comments[0]?.author.displayName ?? pin.createdBy.displayName}<small>{formatDate(pin.createdAt)}</small></span>
              <span className="feedback-card-comment-count"><MessageCircle size={12} /> {pin.comments.length}</span>
            </button>
            <button type="button" className="feedback-preview" onClick={() => onSelectPin(pin)}>{pin.comments[0]?.body ?? "Nuevo punto. Añade el primer comentario."}</button>
            {selectedPinId === pin.id && (
              <PinThread
                pin={pin}
                number={pin.pinNumber}
                reviewer={reviewer}
                busy={busy}
                commentBody={commentBody}
                setCommentBody={onCommentBodyChange}
                replyToCommentId={replyToCommentId}
                setReplyToCommentId={onReplyToCommentChange}
                onSubmit={onSubmitComment}
                onResolve={() => onResolvePin(pin)}
              />
            )}
          </article>
        ))}
      </div>
      <div className="sidebar-footer"><span><span className="privacy-lock">●</span> Acceso de equipo</span><span>SpotCheck <b>·</b> Beta</span></div>
    </aside>
  );
}
