"use client";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { LoginPanel } from "./LoginPanel";
export function AccessGate({ children }: { readonly children: React.ReactNode }) {
  const { account, loading, error } = useAuth();
  if (loading) return <main className="auth-page" aria-busy="true"><section className="auth-card"><div className="auth-skeleton" /><div className="auth-skeleton" /><p>Preparando tu espacio…</p></section></main>;
  if (!account) return <LoginPanel />;
  if (error) return <main className="auth-page" role="alert"><p>{error}</p><Link href="/account-status">Revisar estado de cuenta</Link></main>;
  return children;
}
