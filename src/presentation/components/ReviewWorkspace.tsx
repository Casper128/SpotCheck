"use client";
/* eslint-disable @next/next/no-img-element -- Intrinsic image bounds must match the pin coordinate overlay. */

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Copy,
  ExternalLink,
  FileImage,
  Globe,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { Canvas } from "@/domain/entities/Canvas";
import type { Comment } from "@/domain/entities/Comment";
import type { Pin } from "@/domain/entities/Pin";
import { useReviewStore, type GuestSession } from "@/presentation/store/reviewStore";

function getErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(body, "No se pudo completar la acción."));
  return body as T;
}

function getBrowserDetails(userAgent: string): {
  readonly browser: { readonly name: string; readonly version?: string };
  readonly operatingSystem: { readonly name: string; readonly version?: string };
} {
  const browsers: readonly [RegExp, string][] = [
    [/Edg\/([\d.]+)/, "Microsoft Edge"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  const detectedBrowser = browsers.map(([pattern, name]) => ({ match: userAgent.match(pattern), name })).find((entry) => entry.match);
  const operatingSystems: readonly [RegExp, string][] = [
    [/Windows NT ([\d.]+)/, "Windows"],
    [/Mac OS X ([\d_]+)/, "macOS"],
    [/Android ([\d.]+)/, "Android"],
    [/iPhone OS ([\d_]+)/, "iOS"],
    [/Linux/, "Linux"],
  ];
  const detectedOs = operatingSystems.map(([pattern, name]) => ({ match: userAgent.match(pattern), name })).find((entry) => entry.match);
  return {
    browser: detectedBrowser?.match ? { name: detectedBrowser.name, version: detectedBrowser.match[1] } : { name: "Navegador" },
    operatingSystem: detectedOs?.match ? { name: detectedOs.name, version: detectedOs.match[1]?.replaceAll("_", ".") } : { name: "Sistema operativo" },
  };
}

function getStorageKey(shareId: string): string {
  return `pastel:reviewer:${shareId}`;
}

export default function ReviewWorkspace({ canvas: initialCanvas }: { readonly canvas: Canvas }) {
  const [canvas, setCanvas] = useState(initialCanvas);
  const [reviewerReady, setReviewerReady] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const guestNameRef = useRef<HTMLInputElement>(null);
  const commentingEnabled = useReviewStore((state) => state.commentingEnabled);
  const selectedPinId = useReviewStore((state) => state.selectedPinId);
  const filter = useReviewStore((state) => state.filter);
  const reviewer = useReviewStore((state) => state.reviewer);
  const setCommentingEnabled = useReviewStore((state) => state.setCommentingEnabled);
  const setSelectedPinId = useReviewStore((state) => state.setSelectedPinId);
  const setFilter = useReviewStore((state) => state.setFilter);
  const setReviewer = useReviewStore((state) => state.setReviewer);
  const clearReviewer = useReviewStore((state) => state.clearReviewer);

  const sourceUrl = canvas.imageSource.kind === "external-url"
    ? canvas.imageSource.url
    : canvas.imageSource.path;
  const pins = useMemo(() => [...canvas.pins].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)), [canvas.pins]);
  const openPins = useMemo(() => pins.filter((pin) => pin.status === "open"), [pins]);
  const resolvedPins = useMemo(() => pins.filter((pin) => pin.status === "resolved"), [pins]);
  const visiblePins = filter === "open" ? openPins : resolvedPins;
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null;

  useEffect(() => {
    clearReviewer();
    setSelectedPinId(null);
    setCommentingEnabled(false);
    let storageError: string | null = null;
    try {
      const saved = window.localStorage.getItem(getStorageKey(canvas.shareId));
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (typeof parsed === "object" && parsed !== null && "id" in parsed && "displayName" in parsed && typeof parsed.id === "string" && typeof parsed.displayName === "string") {
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
  }, [canvas.shareId, clearReviewer, setCommentingEnabled, setReviewer, setSelectedPinId]);

  useEffect(() => {
    if (reviewerReady && !reviewer) guestNameRef.current?.focus();
  }, [reviewerReady, reviewer]);

  useEffect(() => {
    if (!selectedPinId) return;
    const animationFrame = window.requestAnimationFrame(() => {
      document.getElementById(`pin-${selectedPinId}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [selectedPinId, canvas.pins]);

  const reloadCanvas = useCallback(async () => {
    const result = await requestJson<{ readonly canvas: Canvas }>(`/api/canvases/${encodeURIComponent(canvas.shareId)}`);
    setCanvas(result.canvas);
    return result.canvas;
  }, [canvas.shareId]);

  function rememberReviewer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = reviewerName.trim();
    if (!displayName) {
      guestNameRef.current?.focus();
      return;
    }
    const session: GuestSession = { id: crypto.randomUUID(), displayName };
    try {
      window.localStorage.setItem(getStorageKey(canvas.shareId), JSON.stringify(session));
      setReviewer(session);
      setError(null);
    } catch (storageError) {
      console.error("Could not save the reviewer session:", storageError);
      setError("No se pudo guardar tu nombre en este navegador. Revisa el almacenamiento y vuelve a intentarlo.");
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

  async function addPin(event: MouseEvent<HTMLDivElement>) {
    if (!commentingEnabled || !reviewer || busy || !surfaceRef.current) return;
    const bounds = surfaceRef.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    const details = getBrowserDetails(navigator.userAgent);
    setBusy(true);
    setError(null);
    try {
      const result = await requestJson<{ readonly pin: Pin }>(`/api/canvases/${encodeURIComponent(canvas.shareId)}/pins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          x,
          y,
          author: reviewer,
          snapshot: {
            reviewedUrl: canvas.browserMetadata.pageUrl,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            ...details,
          },
        }),
      });
      setFilter("open");
      setSelectedPinId(result.pin.id);
      setCommentingEnabled(false);
      await reloadCanvas();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear el comentario.");
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewer || !selectedPin || !commentBody.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson<{ readonly comment: Comment }>(
        `/api/canvases/${encodeURIComponent(canvas.shareId)}/pins/${encodeURIComponent(selectedPin.id)}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            body: commentBody.trim(),
            author: reviewer,
            ...(replyToCommentId ? { replyToCommentId } : {}),
          }),
        },
      );
      setCommentBody("");
      setReplyToCommentId(null);
      await reloadCanvas();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo enviar el comentario.");
    } finally {
      setBusy(false);
    }
  }

  async function resolvePin(pin: Pin) {
    if (!reviewer || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson<{ readonly pin: Pin }>(
        `/api/canvases/${encodeURIComponent(canvas.shareId)}/pins/${encodeURIComponent(pin.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resolvedBy: reviewer }),
        },
      );
      setSelectedPinId(null);
      setFilter("open");
      setNotice(`Punto #${pins.findIndex((entry) => entry.id === pin.id) + 1} marcado como resuelto.`);
      window.setTimeout(() => setNotice(null), 2400);
      await reloadCanvas();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo resolver el punto.");
    } finally {
      setBusy(false);
    }
  }

  function choosePin(pin: Pin) {
    setFilter(pin.status);
    setSelectedPinId(pin.id);
  }

  return (
    <main className="review-shell">
      <header className="review-topbar">
        <Link className="review-brand" href="/" aria-label="Volver a SpotCheck">
          <span className="brand-mark"><span /></span><span>spotcheck<span className="brand-period">.</span></span>
        </Link>
        <span className="review-header-divider" />
        <Link className="back-to-projects" href="/"><ArrowLeft size={15} /> Proyectos</Link>
        <span className="review-header-divider review-desktop-only" />
        <div className="review-title"><strong>{canvas.browserMetadata.pageTitle}</strong><span>{canvas.imageSource.kind === "external-url" ? canvas.imageSource.url : "Imagen subida"}</span></div>
        <div className="review-top-actions">
          <a className="open-source-button" href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /><span>Abrir original</span></a>
          <button className="share-button" type="button" onClick={() => void copyLink()}>{copied ? <Check size={14} /> : <Copy size={14} />}<span>{copied ? "Copiado" : "Compartir"}</span></button>
          <button className="review-avatar" type="button" aria-label="Cambiar nombre de revisor" onClick={() => { clearReviewer(); setReviewerName(""); }}>{reviewer?.displayName.slice(0, 1).toUpperCase() ?? "?"}</button>
        </div>
      </header>

      <div className="review-toolbar">
        <div className="toolbar-context"><span className="context-icon">{canvas.imageSource.kind === "external-url" ? <Globe size={14} /> : <FileImage size={14} />}</span><span>Vista de revisión</span><ChevronDown size={13} /></div>
        <div className="toolbar-controls">
          <span className="toolbar-divider" />
          <button className={commentingEnabled ? "tool-button tool-button-active" : "tool-button"} type="button" onClick={() => { setSelectedPinId(null); setCommentingEnabled(!commentingEnabled); }} aria-pressed={commentingEnabled}><MessageCircle size={15} /><span>{commentingEnabled ? "Haz clic para pinear" : "Comentar"}</span></button>
          <span className="toolbar-divider" />
          <span className="toolbar-tip"><MousePointer2 size={13} /> {commentingEnabled ? "Selecciona un punto en la vista" : "Los comentarios se fijan en el diseño"}</span>
        </div>
        <div className="toolbar-right"><span className="toolbar-live-dot" /> Guardado automáticamente <button className="toolbar-more" type="button" aria-label="Más opciones"><MoreHorizontal size={17} /></button></div>
      </div>

      <div className="review-body">
        <section className="viewer-column" aria-label="Visor de revisión">
          <div className="viewer-stage">
            <div className="viewer-stage-label"><span>CANVAS</span><span>·</span><span>{canvas.browserMetadata.viewportWidth} × {canvas.browserMetadata.viewportHeight}</span></div>
            <div className="viewer-content">
              {canvas.imageSource.kind === "uploaded-path" ? (
                <div className="image-canvas-wrap">
                  <img className="review-image" src={sourceUrl} alt={canvas.browserMetadata.pageTitle} onError={() => setError("No se pudo cargar la imagen de este proyecto.")} />
                  <div
                    className={commentingEnabled ? "pin-capture-layer pin-capture-active" : "pin-capture-layer"}
                    ref={surfaceRef}
                    onClick={(event) => void addPin(event)}
                    aria-label={commentingEnabled ? "Haz clic en la imagen para añadir un comentario" : undefined}
                  >
                    {pins.map((pin, index) => <PinMarker key={pin.id} pin={pin} number={index + 1} selected={selectedPinId === pin.id} onSelect={() => choosePin(pin)} />)}
                  </div>
                </div>
              ) : (
                <div className="web-canvas-wrap">
                  <iframe
                    className="review-iframe"
                    src={canvas.imageSource.url}
                    title={`Vista de revisión de ${canvas.browserMetadata.pageTitle}`}
                    sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="no-referrer"
                  />
                  <div
                    className={commentingEnabled ? "pin-capture-layer pin-capture-active" : "pin-capture-layer"}
                    ref={surfaceRef}
                    onClick={(event) => void addPin(event)}
                    aria-label={commentingEnabled ? "Haz clic en la página para añadir un comentario" : undefined}
                  >
                    {pins.map((pin, index) => <PinMarker key={pin.id} pin={pin} number={index + 1} selected={selectedPinId === pin.id} onSelect={() => choosePin(pin)} />)}
                  </div>
                </div>
              )}
            </div>
            {canvas.imageSource.kind === "external-url" && <div className="iframe-hint"><CircleHelp size={13} /> Si el sitio no aparece, puede bloquear vistas integradas. <a href={sourceUrl} target="_blank" rel="noreferrer">Ábrelo en otra pestaña <ArrowUpRight size={11} /></a></div>}
            {commentingEnabled && <div className="pin-mode-tip"><Plus size={13} /> Haz clic donde quieras dejar feedback</div>}
          </div>
        </section>

        <aside className="comments-sidebar" aria-label="Comentarios">
          <div className="sidebar-heading"><div><div className="sidebar-title-row"><h2>Feedback</h2><span className="feedback-total">{pins.length}</span></div><p>Comentarios sobre este proyecto</p></div><button className="sidebar-close" type="button" aria-label="Cerrar panel" onClick={() => setSelectedPinId(null)}><X size={15} /></button></div>
          <div className="filter-tabs" role="tablist" aria-label="Filtrar puntos">
            <button type="button" role="tab" aria-selected={filter === "open"} className={filter === "open" ? "filter-tab filter-tab-active" : "filter-tab"} onClick={() => { setFilter("open"); setSelectedPinId(null); }}>Pendientes <span>{openPins.length}</span></button>
            <button type="button" role="tab" aria-selected={filter === "resolved"} className={filter === "resolved" ? "filter-tab filter-tab-active" : "filter-tab"} onClick={() => { setFilter("resolved"); setSelectedPinId(null); }}>Resueltos <span>{resolvedPins.length}</span></button>
          </div>

          <div className="feedback-list">
            {visiblePins.length === 0 ? (
              <div className="feedback-empty"><span className="feedback-empty-icon">{filter === "open" ? <MessageCircle size={17} /> : <CheckCheck size={17} />}</span><strong>{filter === "open" ? "Todo está en calma" : "Nada resuelto todavía"}</strong><span>{filter === "open" ? "Activa Comentar y pinea un punto para iniciar la conversación." : "Los puntos resueltos aparecerán aquí."}</span>{filter === "open" && <button className="empty-comment-button" type="button" onClick={() => setCommentingEnabled(true)}><Plus size={13} /> Añadir un comentario</button>}</div>
            ) : visiblePins.map((pin) => {
              const number = pins.findIndex((entry) => entry.id === pin.id) + 1;
              const isSelected = selectedPinId === pin.id;
              return (
                <article className={isSelected ? "feedback-card feedback-card-selected" : "feedback-card"} key={pin.id}>
                  <button type="button" className="feedback-card-head" onClick={() => choosePin(pin)}>
                    <span className={pin.status === "resolved" ? "pin-number pin-number-resolved" : "pin-number"}>{number}</span>
                    <span className="feedback-card-author">{pin.comments[0]?.author.displayName ?? pin.createdBy.displayName}<small>{formatDate(pin.createdAt)}</small></span>
                    <span className="feedback-card-comment-count"><MessageCircle size={12} /> {pin.comments.length}</span>
                  </button>
                  <button type="button" className="feedback-preview" onClick={() => choosePin(pin)}>{pin.comments[0]?.body ?? "Nuevo punto. Añade el primer comentario."}</button>
                  {isSelected && <PinDiscussion pin={pin} number={number} reviewer={reviewer} busy={busy} commentBody={commentBody} setCommentBody={setCommentBody} replyToCommentId={replyToCommentId} setReplyToCommentId={setReplyToCommentId} onSubmit={submitComment} onResolve={() => void resolvePin(pin)} />}
                </article>
              );
            })}
          </div>
          <div className="sidebar-footer"><span><span className="privacy-lock">●</span> Enlace privado</span><span>SpotCheck <b>·</b> Beta</span></div>
        </aside>
      </div>

      {error && <div className="review-toast review-toast-error" role="alert"><span>{error}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setError(null)}><X size={14} /></button></div>}
      {notice && <div className="review-toast review-toast-success" role="status"><Check size={14} />{notice}</div>}
      {reviewerReady && !reviewer && <div className="modal-backdrop"><form className="guest-modal" onSubmit={rememberReviewer}>
        <div className="guest-modal-mark"><span className="brand-mark"><span /></span><span>spotcheck<span className="brand-period">.</span></span></div>
        <span className="guest-kicker">TE HAN INVITADO A REVISAR</span>
        <h1>Antes de empezar,<br /><em>¿cómo te llamas?</em></h1>
        <p>Tu nombre aparecerá junto a tus comentarios. No hace falta crear una cuenta.</p>
        <label className="field-label" htmlFor="guest-name">Tu nombre</label>
        <input ref={guestNameRef} className="text-field guest-name-input" id="guest-name" required minLength={1} maxLength={80} autoComplete="name" value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="p. ej. Taylor" />
        <button className="button-primary guest-submit" type="submit">Entrar a la revisión <ArrowUpRight size={15} /></button>
        <span className="guest-note">Tu sesión se guarda solo en este dispositivo.</span>
      </form></div>}
    </main>
  );
}

function PinMarker({ pin, number, selected, onSelect }: { readonly pin: Pin; readonly number: number; readonly selected: boolean; readonly onSelect: () => void }) {
  return (
    <button
      className={`pin-marker${pin.status === "resolved" ? " pin-marker-resolved" : ""}${selected ? " pin-marker-selected" : ""}`}
      id={`pin-${pin.id}`}
      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
      type="button"
      aria-label={`Punto ${number}${pin.status === "resolved" ? ", resuelto" : ""}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      {pin.status === "resolved" ? <Check size={12} strokeWidth={3} /> : number}
    </button>
  );
}

function PinDiscussion({
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

function formatDate(value: string): string {
  return new Date(value).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
