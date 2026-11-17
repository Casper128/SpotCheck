import type { DOMAnchor } from "@/domain/types";

export const DOM_INSPECTOR_PROTOCOL = "spotcheck-dom";
export const DOM_INSPECTOR_VERSION = 2;
export const MAX_INSPECTOR_PINS = 500;
export const MAX_CONTAINER_CANDIDATES = 12;

export type PinPlacementMode = "off" | "element" | "container" | "free";
export type InspectorTargetMode = Extract<PinPlacementMode, "element" | "container">;

export interface InspectorRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface InspectorCandidate {
  readonly selector: string;
  readonly label: string;
  readonly rect: InspectorRect;
}

export function normalizeViewportPoint(
  pointX: number,
  pointY: number,
  viewportWidth: number,
  viewportHeight: number,
): { readonly x: number; readonly y: number } {
  return {
    x: pointX / viewportWidth,
    y: pointY / viewportHeight,
  };
}

export type InspectorMessage =
  | { readonly type: "ready"; readonly href: string; readonly parentOrigin: string }
  | { readonly type: "route"; readonly href: string }
  | { readonly type: "hover"; readonly mode: InspectorTargetMode; readonly candidates: readonly InspectorCandidate[]; readonly selectedSelector: string }
  | { readonly type: "selected"; readonly mode: InspectorTargetMode; readonly href: string; readonly anchor: DOMAnchor; readonly pointX: number; readonly pointY: number; readonly viewportWidth: number; readonly viewportHeight: number; readonly scrollX: number; readonly scrollY: number }
  | { readonly type: "point"; readonly href: string; readonly pointX: number; readonly pointY: number; readonly viewportWidth: number; readonly viewportHeight: number; readonly scrollX: number; readonly scrollY: number }
  | { readonly type: "positions"; readonly positions: readonly { readonly id: string; readonly rect: InspectorRect; readonly viewportWidth: number; readonly viewportHeight: number }[]; readonly missing: readonly string[]; readonly viewportWidth: number; readonly viewportHeight: number; readonly scrollX: number; readonly scrollY: number };

export type InspectorPlacementMessage = Extract<InspectorMessage, { readonly type: "selected" | "point" }>;

export type InspectorPlacementAction =
  | { readonly type: "anchor"; readonly message: Extract<InspectorMessage, { readonly type: "selected" }> }
  | { readonly type: "point"; readonly message: Extract<InspectorMessage, { readonly type: "point" }> };

export function getInspectorPlacementAction(
  message: InspectorPlacementMessage,
  activeMode: PinPlacementMode,
): InspectorPlacementAction | null {
  if (message.type === "selected" && activeMode === message.mode) {
    return { type: "anchor", message };
  }
  if (message.type === "point" && activeMode === "free") {
    return { type: "point", message };
  }
  return null;
}

export function isTrustedInspectorEvent(
  event: Pick<MessageEvent<unknown>, "source" | "origin" | "data">,
  expectedSource: MessageEventSource | null,
  expectedOrigin: string,
  nonce: string,
  expectedParentOrigin: string,
): event is MessageEvent<InspectorMessage> {
  if (event.source !== expectedSource || event.origin !== expectedOrigin || !isInspectorMessage(event.data, nonce)) return false;
  return event.data.type !== "ready" || event.data.parentOrigin === expectedParentOrigin;
}

export function isInspectorMessage(value: unknown, nonce: string): value is InspectorMessage {
  if (!isRecord(value)
    || value.protocol !== DOM_INSPECTOR_PROTOCOL
    || value.version !== DOM_INSPECTOR_VERSION
    || value.nonce !== nonce
    || typeof value.type !== "string") return false;

  if (value.type === "ready") return isHttpUrl(value.href) && isHttpOrigin(value.parentOrigin);
  if (value.type === "route") return isHttpUrl(value.href);
  if (value.type === "hover") {
    return (value.mode === "element" || value.mode === "container")
      && Array.isArray(value.candidates)
      && value.candidates.length <= MAX_CONTAINER_CANDIDATES
      && (value.mode !== "element" || value.candidates.length <= 1)
      && value.candidates.every(isInspectorCandidate)
      && typeof value.selectedSelector === "string"
      && value.selectedSelector.length <= 1200
      && (!value.selectedSelector || value.candidates.some((candidate) => candidate.selector === value.selectedSelector));
  }
  if (value.type === "selected") {
    return (value.mode === "element" || value.mode === "container")
      && isHttpUrl(value.href)
      && isSelector(value.anchor)
      && finitePositive(value.viewportWidth)
      && finitePositive(value.viewportHeight)
      && finiteCoordinate(value.pointX, value.viewportWidth)
      && finiteCoordinate(value.pointY, value.viewportHeight)
      && finiteSigned(value.scrollX)
      && finiteSigned(value.scrollY);
  }
  if (value.type === "point") {
    return !("anchor" in value) && !("domAnchor" in value)
      && isHttpUrl(value.href)
      && finitePositive(value.viewportWidth)
      && finitePositive(value.viewportHeight)
      && finiteCoordinate(value.pointX, value.viewportWidth)
      && finiteCoordinate(value.pointY, value.viewportHeight)
      && finiteSigned(value.scrollX)
      && finiteSigned(value.scrollY);
  }
  if (value.type === "positions") {
    return Array.isArray(value.positions)
      && value.positions.length <= MAX_INSPECTOR_PINS
      && value.positions.every((position) => isRecord(position)
        && typeof position.id === "string" && position.id.length > 0 && position.id.length <= 200
        && isRect(position.rect)
        && finitePositive(position.viewportWidth)
        && finitePositive(position.viewportHeight))
      && Array.isArray(value.missing)
      && value.missing.length <= MAX_INSPECTOR_PINS
      && value.missing.every((id) => typeof id === "string" && id.length > 0 && id.length <= 200)
      && finitePositive(value.viewportWidth)
      && finitePositive(value.viewportHeight)
      && finiteSigned(value.scrollX)
      && finiteSigned(value.scrollY);
  }
  return false;
}

function isInspectorCandidate(value: unknown): value is InspectorCandidate {
  return isRecord(value)
    && isSelectorString(value.selector)
    && typeof value.label === "string"
    && value.label.length > 0
    && value.label.length <= 160
    && isRect(value.rect);
}

function isSelector(value: unknown): value is DOMAnchor {
  return isRecord(value)
    && isSelectorString(value.selector)
    && finiteUnit(value.offsetX)
    && finiteUnit(value.offsetY);
}

function isSelectorString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 1200;
}

function isRect(value: unknown): value is InspectorRect {
  return isRecord(value)
    && finiteSigned(value.left)
    && finiteSigned(value.top)
    && finiteNonNegative(value.width)
    && finiteNonNegative(value.height)
    && value.width <= 100_000 && value.height <= 100_000;
}

function finiteUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100_000;
}

function finiteCoordinate(value: unknown, viewportSize: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && typeof viewportSize === "number" && Number.isFinite(viewportSize)
    && viewportSize > 0 && value <= viewportSize;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function finiteSigned(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 100_000;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isHttpOrigin(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
