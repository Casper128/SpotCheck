"use client";
import { Brand } from "../components/Brand";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { authService } from "../dependencies";
export function LoginPanel() {
  const { config, login, error: sessionError } = useAuth();
  const button = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const element = button.current;
    if (!config?.googleConfigured || !config.googleClientId || !element) return;
    let active = true;
    let dispose: (() => void) | undefined;
    void authService.mountGoogle(element, config.googleClientId, (credential) => {
      void login(credential).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión."); setAttempt(value => value + 1); } });
    }).then(cleanup => { if (active) dispose = cleanup; else cleanup(); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Google no está disponible."); });
    return () => { active = false; dispose?.(); };
  }, [config?.googleConfigured, config?.googleClientId, login, attempt]);
  return <main className="auth-page"><section className="auth-card">
    <Brand />
    <p className="auth-eyebrow">TU EQUIPO. EN EL MISMO PUNTO.</p><h1>Revisa en equipo.</h1>
    <p>Accede con tu cuenta de Google para ver los proyectos de tu organización.</p>
    <div ref={button} className="google-signin" hidden={!config?.googleConfigured} />
    {!config?.googleConfigured && <><button className="auth-primary" disabled>Continue with Google</button><p className="auth-notice">El acceso con Google aún no está configurado. Contacta al administrador de tu equipo.</p></>}
    {(error || sessionError) && <p role="alert" className="auth-error">{error || sessionError}</p>}
    <p className="auth-caption">Inicia sesión con Google y comienza a revisar.</p>
  </section></main>;
}
