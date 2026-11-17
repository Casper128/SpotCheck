import {
  ChevronDown,
  FileImage,
  Globe,
  RefreshCw,
} from "lucide-react";
import type { Canvas } from "@/domain/types";
import type { PinPlacementMode } from "@/presentation/domInspectorProtocol";

const placementOptions: readonly { readonly mode: PinPlacementMode; readonly label: string }[] = [
  { mode: "off", label: "Interactuar" },
  { mode: "element", label: "Elemento" },
  { mode: "container", label: "Contenedor" },
  { mode: "free", label: "Punto libre" },
];

export function ReviewToolbar({
  canvas,
  placementMode,
  inspectorAvailable,
  feedbackVisible,
  onShowFeedback,
  onRefresh,
  onPlacementModeChange,
}: {
  readonly canvas: Canvas;
  readonly placementMode: PinPlacementMode;
  readonly inspectorAvailable: boolean;
  readonly feedbackVisible: boolean;
  readonly onShowFeedback: () => void;
  readonly onRefresh: () => void;
  readonly onPlacementModeChange: (mode: PinPlacementMode) => void;
}) {
  const imageProject = canvas.imageSource.kind === "uploaded-path";
  const freePointHint = placementMode === "free" && !imageProject && !inspectorAvailable
    ? "Punto libre: coordenadas del viewport; no sigue el scroll interno."
    : "Coloca un punto sin anclarlo a un elemento";

  return (
    <div className="review-toolbar">
      <div className="toolbar-context">
        <span className="context-icon">{imageProject ? <FileImage size={14} /> : <Globe size={14} />}</span>
        <span>Vista de revisión</span><ChevronDown size={13} />
      </div>
      <div className="toolbar-controls">
        <div className="placement-tools" role="group" aria-label="Herramientas de ubicación">
          {placementOptions.map(({ mode, label }) => {
            const inspectorMode = mode === "element" || mode === "container";
            const disabled = inspectorMode && (imageProject || !inspectorAvailable);
            return (
              <button
                key={mode}
                className={placementMode === mode ? "tool-button tool-button-active" : "tool-button"}
                type="button"
                aria-pressed={placementMode === mode}
                aria-label={label}
                title={disabled
                  ? imageProject ? "La inspección de elementos requiere una página web." : "Instala el script del propietario para inspeccionar elementos."
                  : label}
                disabled={disabled}
                onClick={() => onPlacementModeChange(mode)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span className="toolbar-tip" aria-live="polite">
          {placementMode === "off" && "Interactúa con el sitio de este proyecto"}
          {placementMode === "element" && "Selecciona el elemento DOM más profundo"}
          {placementMode === "container" && "Elige un contenedor o uno de sus ancestros"}
          {placementMode === "free" && freePointHint}
        </span>
      </div>
      <div className="toolbar-right">
        {!feedbackVisible && <button className="toolbar-feedback-toggle" type="button" aria-controls="feedback-sidebar" aria-expanded="false" onClick={onShowFeedback}>Feedback</button>}
        <span className="toolbar-live-dot" /> Guardado automáticamente <button className="toolbar-more" type="button" aria-label="Actualizar comentarios" onClick={onRefresh}><RefreshCw size={17} /></button>
      </div>
    </div>
  );
}
