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

interface CanvasSummary {
  readonly id: string;
  readonly shareId: string;
  readonly title: string;
  readonly sourceType: "web" | "image";
  readonly sourceUrl: string | null;
  readonly imagePath: string | null;
  readonly createdAt: string;
  readonly pinCount: number;
  readonly openPinCount: number;
}

interface CanvasListResponse {
  readonly canvases: readonly CanvasSummary[];
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

export default function Dashboard() {
  const router = useRouter();
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
    void fetch("/api/canvases")
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(body, "No se pudieron cargar tus proyectos."));
        return body as CanvasListResponse;
      })
      .then((body) => {
        if (active) setCanvases(body.canvases);
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
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("sourceType", sourceType);
      formData.set("viewportWidth", String(window.innerWidth));
      formData.set("viewportHeight", String(window.innerHeight));
      formData.set("deviceScaleFactor", String(window.devicePixelRatio || 1));
      formData.set("userAgent", navigator.userAgent);
      if (sourceType === "web") {
        formData.set("url", url.trim());
      } else if (file) {
        formData.set("image", file);
      }

      const response = await fetch("/api/canvases", { method: "POST", body: formData });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body, "No se pudo crear el proyecto."));
      const result = body as { readonly shareId: string };
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
        <Link className="brand-lockup" href="/" aria-label="SpotCheck inicio">
          <span className="brand-mark"><span /></span>
          <span>spotcheck<span className="brand-period">.</span></span>
        </Link>
        <div className="rail-rule" />
        <button className="rail-item rail-item-active" type="button" aria-label="Proyectos">
          <LayoutGrid size={18} strokeWidth={1.8} />
        </button>
        <div className="rail-bottom">
          <button className="rail-item" type="button" aria-label="Ayuda">
            <CircleHelp size={18} strokeWidth={1.8} />
          </button>
          <span className="profile-chip" aria-label="Tu perfil">T</span>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb"><span>Espacio de trabajo</span><span className="breadcrumb-slash">/</span><strong>Proyectos</strong></div>
          <div className="topbar-right"><span className="online-dot" /> Tu espacio personal</div>
        </header>

        <section className="dashboard-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow"><Sparkles size={13} /> TU ESTUDIO DE FEEDBACK</p>
              <h1>Diseñemos algo<br /><span>extraordinario.</span></h1>
              <p className="welcome-copy">Comparte una página o imagen. Tu equipo puede dejar comentarios justo donde importan.</p>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <div className="art-card art-card-back" />
              <div className="art-card art-card-front">
                <span className="art-dot art-dot-one" /><span className="art-dot art-dot-two" />
                <div className="art-line art-line-long" /><div className="art-line art-line-short" />
                <div className="art-comment"><span /> Looking lovely!</div>
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
              <div className="create-actions"><span className="privacy-note"><span className="privacy-lock">●</span> Solo quienes tengan el enlace podrán revisar</span><button className="button-primary" type="submit" disabled={creating || (sourceType === "image" && !file)}>{creating ? <><LoaderCircle className="spin" size={16} /> Preparando...</> : <>Crear revisión <ArrowUpRight size={16} /></>}</button></div>
            </form>
          </section>

          <section className="projects-section">
            <div className="projects-heading"><div><p className="eyebrow">TU ACTIVIDAD</p><h2>Proyectos recientes <span className="count-pill">{canvases.length}</span></h2></div><button className="text-button" type="button" onClick={() => document.getElementById("create-heading")?.scrollIntoView({ behavior: "smooth" })}><Plus size={15} /> Nuevo proyecto</button></div>
            {loadError && <p className="form-error" role="alert">{loadError}</p>}
            {loading ? (
              <div className="empty-state"><LoaderCircle className="spin" size={20} /><span>Cargando tus proyectos...</span></div>
            ) : canvases.length === 0 ? (
              <div className="empty-state empty-state-welcome"><div className="empty-icon"><FileImage size={20} /></div><strong>Tu espacio empieza aquí</strong><span>Crea tu primera revisión y comparte el enlace para recibir feedback.</span></div>
            ) : (
              <div className="project-grid">
                {canvases.map((canvas, index) => (
                  <article className="project-card" key={canvas.id}>
                    <Link className="project-preview" href={`/review/${encodeURIComponent(canvas.shareId)}`}>
                      {canvas.sourceType === "image" && canvas.imagePath ? <Image src={canvas.imagePath} alt="" fill sizes="(max-width: 520px) 100vw, 33vw" unoptimized /> : <div className={`web-preview web-preview-${index % 3}`}><span className="preview-top"><i /><i /><i /></span><span className="preview-title" /><span className="preview-copy" /><span className="preview-copy preview-copy-short" /><span className="preview-button" /></div>}
                      <span className="project-source-badge">{canvas.sourceType === "image" ? <FileImage size={12} /> : <Globe size={12} />}{canvas.sourceType === "image" ? "Imagen" : "Web"}</span>
                    </Link>
                    <div className="project-card-body"><div className="project-card-title"><Link href={`/review/${encodeURIComponent(canvas.shareId)}`}>{canvas.title}</Link><button type="button" className="icon-button" aria-label="Copiar enlace de revisión" onClick={() => void copyReviewLink(canvas)}>{copiedCanvas === canvas.id ? <Check size={15} /> : <Copy size={15} />}</button></div><p className="project-card-subtitle">{canvas.sourceType === "image" ? "Imagen subida" : canvas.sourceUrl} {canvas.sourceType === "web" && <ArrowUpRight size={12} />}</p><div className="project-card-footer"><span>{new Date(canvas.createdAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" })}</span><span className={canvas.openPinCount ? "feedback-count feedback-count-active" : "feedback-count"}><span className="feedback-dot" />{canvas.openPinCount} pendientes</span></div></div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <footer className="dashboard-footer"><span>Hecho para que las buenas ideas se encuentren.</span><span>SpotCheck <b>·</b> Beta</span></footer>
        </section>
      </main>
    </div>
  );
}
