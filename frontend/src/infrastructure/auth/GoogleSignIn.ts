import type { GoogleSignIn } from "../../domain/ports/AuthApi";
interface GoogleSdk {
  accounts: { id: {
    initialize(options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void; auto_select: boolean }): void;
    renderButton(element: HTMLElement, options: { text: string; theme: string; size: string; width: number }): void;
    cancel(): void;
  } };
}
type GoogleWindow = Window & { google?: GoogleSdk };
let loading: Promise<GoogleSdk> | null = null;
function sdk(): Promise<GoogleSdk> {
  const loaded = (window as GoogleWindow).google;
  if (loaded) return Promise.resolve(loaded);
  if (!loading) loading = new Promise<GoogleSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => { const value = (window as GoogleWindow).google; if (value) resolve(value); else { loading = null; reject(new Error("Google no está disponible.")); } };
    script.onerror = () => { loading = null; script.remove(); reject(new Error("No se pudo cargar Google. Revisa tu conexión.")); };
    document.head.appendChild(script);
  });
  return loading;
}
export class BrowserGoogleSignIn implements GoogleSignIn {
  async mount(element: HTMLElement, clientId: string, nonce: string, onCredential: (credential: string) => void): Promise<() => void> {
    const google = await sdk();
    let active = true;
    google.accounts.id.initialize({ client_id: clientId, nonce, auto_select: false, callback: response => { if (active) onCredential(response.credential); } });
    google.accounts.id.renderButton(element, { text: "continue_with", theme: "filled_black", size: "large", width: Math.max(200, Math.min(320, Math.floor(element.getBoundingClientRect().width || 320))) });
    return () => { active = false; google.accounts.id.cancel(); element.replaceChildren(); };
  }
}
