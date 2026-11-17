"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Account, PublicConfig } from "@spotcheck/shared";
import { ReviewApiError } from "../../domain/ports/ReviewApi";
import { authService, workspaceService } from "../dependencies";
interface AuthState { account: Account | null; config: PublicConfig | null; loading: boolean; error: string | null; login(credential: string): Promise<void>; logout(): Promise<void>; refresh(): Promise<void>; }
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { readonly children: React.ReactNode }) {
  const generation = useRef(0);
  const [account, storeAccount] = useState<Account | null>(null);
  const setAccount = useCallback((value: Account | null) => { workspaceService.setIdentity(value); storeAccount(value); }, []);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    try { const current = await authService.account(); if (version === generation.current) { setAccount(current); setError(null); } }
    catch (reason) { if (version !== generation.current) return; setAccount(null); if (!(reason instanceof ReviewApiError && reason.status === 401)) setError(reason instanceof Error ? reason.message : "No se pudo consultar la sesión."); }
  }, [setAccount]);
  useEffect(() => {
    let active = true;
    const version = ++generation.current;
    void Promise.all([authService.configuration(), authService.account().catch(reason => { if (reason instanceof ReviewApiError && reason.status === 401) return null; throw reason; })])
      .then(([settings, user]) => { if (active) { setConfig(settings); if (version === generation.current) setAccount(user); } })
      .catch((reason: unknown) => { if (active && version === generation.current) setError(reason instanceof Error ? reason.message : "No se pudo iniciar la aplicación."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setAccount]);
  useEffect(() => { const focus = () => { void refresh(); }; window.addEventListener("focus", focus); return () => window.removeEventListener("focus", focus); }, [refresh]);
  const login = useCallback(async (credential: string) => { const version = ++generation.current; const user = await authService.login(credential); if (version === generation.current) { setAccount(user); setError(null); } }, [setAccount]);
  const logout = useCallback(async () => { const version = ++generation.current; try { await authService.logout(); if (version === generation.current) { setAccount(null); setError(null); } } catch (reason) { if (version === generation.current) setError(reason instanceof Error ? reason.message : "No se pudo cerrar sesión."); } }, [setAccount]);
  const state = useMemo(() => ({ account, config, loading, error, login, logout, refresh }), [account, config, loading, error, login, logout, refresh]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useAuth() { const state = useContext(Context); if (!state) throw new Error("AuthProvider requerido."); return state; }
