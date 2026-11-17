import { buildWorkspaceRoutes, type Account, type AddPinRequest, type AddCommentRequest, type ResolvePinRequest, type ProjectWorkspace, type Pin } from "@spotcheck/shared";
import type { WorkspaceApi } from "../domain/ports/WorkspaceApi";
import { ReviewApiError } from "../domain/ports/ReviewApi";
interface Entry { data: ProjectWorkspace | null; mutations: number; pending?: Promise<ProjectWorkspace>; }
export class WorkspaceService {
  private identity: string | null = null;
  private generation = 0;
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly api: WorkspaceApi) {}
  setIdentity(account: Pick<Account, "id" | "organizationId" | "status"> | null) {
    const identity = account?.organizationId ? `${account.id}:${account.organizationId}` : null;
    if (identity === this.identity) return;
    this.identity = identity; this.generation++; this.entries.clear(); this.notify();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  hasIdentity(): boolean { return this.identity !== null; }
  snapshot(identifier: string): ProjectWorkspace | null { return this.entries.get(identifier)?.data ?? null; }
  private notify() { for (const listener of this.listeners) listener(); }
  private async protected<T>(request: Promise<T>, version: number): Promise<T> {
    try { return await request; }
    catch (reason) {
      if (version === this.generation && reason instanceof ReviewApiError && (reason.status === 401 || reason.status === 403)) this.setIdentity(null);
      throw reason;
    }
  }
  private current(version: number) { if (version !== this.generation || !this.identity) throw new ReviewApiError("La sesión cambió. Vuelve a abrir el proyecto.", 401); }
  load(identifier: string, refresh = false): Promise<ProjectWorkspace> {
    if (!this.identity) return Promise.reject(new ReviewApiError("Inicia sesión para continuar.", 401));
    const existing = this.entries.get(identifier);
    if (existing?.pending) return existing.pending;
    if (existing?.data && !refresh) return Promise.resolve(existing.data);
    const entry = existing ?? { data: null, mutations: 0 };
    const mutations = entry.mutations;
    const version = this.generation;
    const request = this.protected(this.api.getWorkspace(identifier), version).then(workspace => {
      this.current(version);
      if (entry.mutations !== mutations && entry.data) return entry.data;
      const project = workspace.project;
      entry.data = project.imageSource.kind === "uploaded-path" ? { ...workspace, siteUrl: this.api.assetUrl(project.imageSource.path), project: { ...project, browserMetadata: { ...project.browserMetadata, pageUrl: this.api.assetUrl(project.imageSource.path) } } } : workspace;
      this.entries.set(project.id, entry); this.entries.set(project.shareId, entry);
      this.notify(); return entry.data;
    }).finally(() => { if (entry.pending === request) entry.pending = undefined; });
    entry.pending = request; this.entries.set(identifier, entry);
    return request;
  }
  private updatePin(identifier: string, pin: Pin, updatedAt: string) {
    const entry = this.entries.get(identifier);
    if (!entry?.data) return;
    entry.mutations++;
    const current = entry.data.project;
    const pins = [...current.pins.filter(existing => existing.id !== pin.id), pin].sort((a, b) => a.pinNumber - b.pinNumber);
    entry.data = { ...entry.data, project: { ...current, pins, revision: current.revision + 1, updatedAt }, routes: buildWorkspaceRoutes(pins) };
    this.notify();
  }
  async addPin(identifier: string, input: AddPinRequest) {
    const version = this.generation; this.current(version);
    const pin = await this.protected(this.api.addPin(identifier, input), version); this.current(version);
    this.updatePin(identifier, pin, pin.createdAt); return pin;
  }
  async addComment(identifier: string, pinId: string, input: AddCommentRequest) {
    const version = this.generation; this.current(version);
    const comment = await this.protected(this.api.addComment(identifier, pinId, input), version); this.current(version);
    const pin = this.snapshot(identifier)?.project.pins.find(pin => pin.id === pinId);
    if (pin) this.updatePin(identifier, { ...pin, comments: [...pin.comments.filter(existing => existing.id !== comment.id), comment] }, comment.createdAt);
    return comment;
  }
  async resolvePin(identifier: string, pinId: string, input: ResolvePinRequest) {
    const version = this.generation; this.current(version);
    const pin = await this.protected(this.api.resolvePin(identifier, pinId, input), version); this.current(version);
    this.updatePin(identifier, pin, pin.resolvedAt ?? pin.createdAt); return pin;
  }
}
