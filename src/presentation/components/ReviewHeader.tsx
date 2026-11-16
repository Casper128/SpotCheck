import { ArrowLeft, Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Canvas } from "@/domain/entities/Canvas";
import type { GuestSession } from "@/presentation/store/reviewStore";

export function ReviewHeader({
  canvas,
  reviewedUrl,
  reviewer,
  copied,
  onCopy,
  onChangeReviewer,
}: {
  readonly canvas: Canvas;
  readonly reviewedUrl: string;
  readonly reviewer: GuestSession | null;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onChangeReviewer: () => void;
}) {
  return (
    <header className="review-topbar">
      <Link className="review-brand" href="/" aria-label="Volver a SpotCheck">
        <span className="brand-mark"><span /></span><span>spotcheck<span className="brand-period">.</span></span>
      </Link>
      <span className="review-header-divider" />
      <Link className="back-to-projects" href="/"><ArrowLeft size={15} /> Proyectos</Link>
      <span className="review-header-divider review-desktop-only" />
      <div className="review-title"><strong>{canvas.browserMetadata.pageTitle}</strong><span>{reviewedUrl}</span></div>
      <div className="review-top-actions">
        <a className="open-source-button" href={reviewedUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /><span>Abrir original</span></a>
        <button className="share-button" type="button" onClick={onCopy}>{copied ? <Check size={14} /> : <Copy size={14} />}<span>{copied ? "Copiado" : "Compartir"}</span></button>
        <button className="review-avatar" type="button" aria-label="Cambiar nombre de revisor" onClick={onChangeReviewer}>{reviewer?.displayName.slice(0, 1).toUpperCase() ?? "?"}</button>
      </div>
    </header>
  );
}
