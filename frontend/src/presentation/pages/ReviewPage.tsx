"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ReviewApiError } from "../../domain/ports/ReviewApi";
import { workspaceService, reviewEnvironment } from "../dependencies";
import { useAuth } from "../auth/AuthProvider";
import ReviewWorkspace from "../components/ReviewWorkspace";
import { WorkspaceSkeleton } from "../components/WorkspaceSkeleton";
const empty = () => null;
export default function ReviewPage({ shareId }: { readonly shareId: string }) {
  const { account, refresh } = useAuth();
  const identity = `${account?.id}:${account?.organizationId}:${shareId}`;
  const snapshot = useCallback(() => workspaceService.snapshot(shareId), [shareId]);
  const workspace = useSyncExternalStore(workspaceService.subscribe, snapshot, empty);
  const authorized = workspaceService.hasIdentity();
  const [failure, setFailure] = useState<{ identifier: string; message: string } | null>(null);
  useEffect(() => {
    if (!authorized) { void refresh(); return; }
    let active = true;
    void workspaceService.load(shareId).catch((reason: unknown) => {
      if (active) setFailure({ identifier: identity, message: reason instanceof ReviewApiError && reason.status === 404 ? "No se encontró esta revisión." : reason instanceof Error ? reason.message : "No se pudo cargar esta revisión." });
    });
    return () => { active = false; };
  }, [shareId, identity, authorized, refresh]);
  if (!workspace && failure?.identifier === identity) return <main className="review-loading" role="alert"><p>{failure.message}</p><Link href="/">Volver a proyectos</Link></main>;
  if (!workspace) return <WorkspaceSkeleton />;
  return <ReviewWorkspace key={`${account?.id}:${account?.organizationId}:${shareId}`} workspace={workspace} proxyOrigin={reviewEnvironment.proxyOrigin} />;
}
