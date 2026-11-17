import { ArrowLeft, Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Brand } from "./Brand";
import type { Canvas } from "@/domain/types";
import type { GuestSession } from "@/presentation/store/reviewStore";

export function ReviewHeader({
  canvas,
  reviewedUrl,
  reviewer,
  copied,
  onCopy,
  onLogout,
}: {
  readonly canvas: Canvas;
  readonly reviewedUrl: string;
  readonly reviewer: GuestSession | null;
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly onLogout: () => void;
}) {
  return (
    <header className="review-topbar">
      <Brand className="review-brand" />
      <span className="review-header-divider" />
      <Link className="back-to-projects" href="/"><ArrowLeft size={15} /> Proyectos</Link>
      <span className="review-header-divider review-desktop-only" />
      <div className="review-title"><strong>{canvas.browserMetadata.pageTitle}</strong><span>{reviewedUrl}</span></div>
      <div className="review-top-actions">
        <a className="open-source-button" href={reviewedUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /><span>Abrir original</span></a>
        <button className="share-button" type="button" onClick={onCopy}>{copied ? <Check size={14} /> : <Copy size={14} />}<span>{copied ? "Copiado" : "Compartir"}</span></button>
        <button className="review-avatar" type="button" aria-label="Salir de la cuenta" onClick={onLogout}>{reviewer?.displayName.slice(0, 1).toUpperCase() ?? "?"}</button>
      </div>
    </header>
  );
}
