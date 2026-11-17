"use client";

import {
  ArrowUpRight,
  Check,
  CircleHelp,
  Copy,
  FileImage,
  Globe,
  LayoutGrid,
  LoaderCircle,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { CanvasSummary } from "@/domain/types";
import { Brand } from "./Brand";
import { useAuth } from "../auth/AuthProvider";
import { reviewService } from "@/presentation/dependencies";

export default function Dashboard() {
  const router = useRouter();
  const { account, logout } = useAuth();
  const [canvases, setCanvases] = useState<readonly CanvasSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<"web" | "image">("web");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedCanvas, setCopiedCanvas] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void reviewService.listCanvases()
      .then((result) => {
        if (active) setCanvases(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "No se pudieron cargar tus proyectos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function createCanvas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const result = await reviewService.createReview({
        title: title.trim(), sourceType,
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
        deviceScaleFactor: window.devicePixelRatio || 1, userAgent: navigator.userAgent,
        ...(sourceType === "web" ? { url: url.trim() } : {}),
        ...(sourceType === "image" && file ? { image: file } : {}),
      });
      router.push(`/review/${encodeURIComponent(result.shareId)}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "No se pudo crear el proyecto.");
      setCreating(false);
    }
  }

  async function copyReviewLink(canvas: CanvasSummary) {
    const link = `${window.location.origin}/review/${encodeURIComponent(canvas.shareId)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCanvas(canvas.id);
      window.setTimeout(() => setCopiedCanvas(null), 1800);
    } catch {
      setLoadError("No se pudo copiar el enlace. Comprueba los permisos del portapapeles.");
    }
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-rail">
        <Brand className="brand-lockup" />
        <div className="rail-rule" />
        <button className="rail-item rail-item-active" type="button" aria-label="Proyectos">
          <LayoutGrid size={18} strokeWidth={1.8} />
        </button>
        <div className="rail-bottom">
          <Link className="rail-item" href="/account-status" aria-label="Estado de cuenta">
            <CircleHelp size={18} strokeWidth={1.8} />
          </Link>
          <button className="profile-chip" type="button" aria-label="Cerrar sesión" title={account?.email} onClick={() => void logout()}>{account?.displayName.slice(0, 1).toUpperCase() ?? "M"}</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb"><span>Espacio de trabajo</span><span className="breadcrumb-slash">/</span><strong>Proyectos</strong></div>
          <div className="team-actions"><span className="topbar-right"><span className="online-dot" /> {account?.organizationName ?? "Tu equipo"}</span><Link href="/account-status">Mi cuenta</Link></div>
        </header>

        <section className="dashboard-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow"><Sparkles size={13} /> TU ESTUDIO DE FEEDBACK</p>
              <h1>Cada detalle.<br /><span>Un mismo equipo.</span></h1>
              <p className="welcome-copy">Comparte una página o imagen. Tu equipo puede dejar comentarios justo donde importan.</p>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <div className="art-card art-card-back" />
              <div className="art-card art-card-front">
                <span className="art-dot art-dot-one" /><span className="art-dot art-dot-two" />
                <div className="art-line art-line-long" /><div className="art-line art-line-short" />
                <div className="art-comment"><span /> En el mismo punto</div>
              </div>
              <div className="art-sparkle">✳</div>
            </div>
          </div>

          <section className="create-card" aria-labelledby="create-heading">
            <div className="create-heading-row">
              <div className="create-heading-icon"><Plus size={18} /></div>
              <div><h2 id="create-heading">Empezar una revisión</h2><p>Un enlace web o una imagen. Sin configuración complicada.</p></div>
            </div>

            <div className="source-switch" role="tablist" aria-label="Tipo de contenido">
              <button type="button" role="tab" aria-selected={sourceType === "web"} className={sourceType === "web" ? "source-tab source-tab-active" : "source-tab"} onClick={() => setSourceType("web")}><Globe size={15} /> Enlace web</button>
              <button type="button" role="tab" aria-selected={sourceType === "image"} className={sourceType === "image" ? "source-tab source-tab-active" : "source-tab"} onClick={() => setSourceType("image")}><FileImage size={15} /> Imagen</button>
            </div>

            <form className="create-form" onSubmit={(event) => void createCanvas(event)}>
              <label className="field-label" htmlFor="canvas-title">Nombre del proyecto <span>(opcional)</span></label>
              <input id="canvas-title" className="text-field title-field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="p. ej. Rediseño de la página de inicio" maxLength={120} />
              {sourceType === "web" ? (
                <>
                  <label className="field-label" htmlFor="canvas-url">URL del sitio que quieres revisar</label>
                  <div className="url-field-wrap"><Globe size={17} /><input id="canvas-url" className="text-field url-field" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://tusitio.com" /></div>
                  <p className="field-hint">Algunos sitios bloquean la vista integrada. En ese caso podrás abrirlos en otra pestaña.</p>
                </>
              ) : (
                <>
                  <span className="field-label">Imagen para revisar</span>
                  <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                  <button className={file ? "upload-zone upload-zone-selected" : "upload-zone"} type="button" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped) setFile(dropped); }}>
                    <span className="upload-icon"><Upload size={19} /></span>
                    <span><strong>{file ? file.name : "Arrastra una imagen o haz clic para elegir"}</strong><small>PNG o JPG · máximo 10 MB</small></span>
                  </button>
                </>
              )}
              {createError && <p className="form-error" role="alert">{createError}</p>}
              <div className="create-actions"><span className="privacy-note"><span className="privacy-lock">●</span> Proyectos privados de tu espacio de trabajo</span><button className="button-primary" type="submit" disabled={creating || (sourceType === "image" && !file)}>{creating ? <><LoaderCircle className="spin" size={16} /> Preparando...</> : <>Crear revisión <ArrowUpRight size={16} /></>}</button></div>
            </form>
          </section>

          <section className="projects-section">
            <div className="projects-heading"><div><p className="eyebrow">TU ACTIVIDAD</p><h2>Proyectos recientes <span className="count-pill">{canvases.length}</span></h2></div><button className="text-button" type="button" onClick={() => document.getElementById("create-heading")?.scrollIntoView({ behavior: "smooth" })}><Plus size={15} /> Nuevo proyecto</button></div>
            {loadError && <p className="form-error" role="alert">{loadError}</p>}
            {loading ? (
              <div className="project-grid" aria-busy="true" aria-label="Cargando proyectos">{[1, 2, 3].map(item => <div className="project-card project-skeleton" key={item}><div className="auth-skeleton" /><div className="auth-skeleton" /></div>)}</div>
            ) : canvases.length === 0 ? (
              <div className="empty-state empty-state-welcome"><div className="empty-icon"><FileImage size={20} /></div><strong>Tu espacio empieza aquí</strong><span>Crea una revisión y comparte el enlace con tu equipo.</span></div>
            ) : (
              <div className="project-grid">
                {canvases.map((canvas, index) => (
                  <article className="project-card" key={canvas.id}>
                    <Link className="project-preview" href={`/review/${encodeURIComponent(canvas.shareId)}`}>
                      {canvas.sourceType === "image" && canvas.imagePath ? <Image src={reviewService.imageUrl(canvas.imagePath)} alt="" fill sizes="(max-width: 520px) 100vw, 33vw" unoptimized /> : <div className={`web-preview web-preview-${index % 3}`}><span className="preview-top"><i /><i /><i /></span><span className="preview-title" /><span className="preview-copy" /><span className="preview-copy preview-copy-short" /><span className="preview-button" /></div>}
                      <span className="project-source-badge">{canvas.sourceType === "image" ? <FileImage size={12} /> : <Globe size={12} />}{canvas.sourceType === "image" ? "Imagen" : "Web"}</span>
                    </Link>
                    <div className="project-card-body"><div className="project-card-title"><Link href={`/review/${encodeURIComponent(canvas.shareId)}`}>{canvas.title}</Link><button type="button" className="icon-button" aria-label="Copiar enlace de revisión" onClick={() => void copyReviewLink(canvas)}>{copiedCanvas === canvas.id ? <Check size={15} /> : <Copy size={15} />}</button></div><p className="project-card-subtitle">{canvas.sourceType === "image" ? "Imagen subida" : canvas.sourceUrl} {canvas.sourceType === "web" && <ArrowUpRight size={12} />}</p><div className="project-card-footer"><span>{new Date(canvas.createdAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" })}</span><span className={canvas.openPinCount ? "feedback-count feedback-count-active" : "feedback-count"}><span className="feedback-dot" />{canvas.openPinCount} pendientes</span></div></div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <footer className="dashboard-footer"><span>Hecho para que las buenas ideas se encuentren.</span><span>Mr. Mamba <b>·</b> Review</span></footer>
        </section>
      </main>
    </div>
  );
}
