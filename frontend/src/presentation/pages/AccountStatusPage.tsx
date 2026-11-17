"use client";
import Link from "next/link";
import { Brand } from "../components/Brand";
import { useAuth } from "../auth/AuthProvider";
import { LoginPanel } from "../auth/LoginPanel";
export default function AccountStatusPage() {
  const { account, loading, logout, error } = useAuth();
  if (loading) return <main className="auth-page" aria-busy="true"><div className="auth-card">Consultando tu cuenta…</div></main>;
  if (!account) return <LoginPanel />;
  return <main className="auth-page"><section className="auth-card"><Brand />
    <h1>Tu cuenta está lista.</h1>
    <p>{account.email}</p><p>{account.organizationName ?? "Tu espacio de trabajo"}</p>
    <p className="auth-notice">Ya puedes crear proyectos y comentar. Tu cuenta de Google es suficiente para acceder.</p>
    <Link href="/" className="auth-primary">Ir a proyectos</Link>
    {error && <p role="alert" className="auth-error">{error}</p>}
    <button className="auth-secondary" onClick={() => void logout()}>Cerrar sesión</button>
  </section></main>;
}
