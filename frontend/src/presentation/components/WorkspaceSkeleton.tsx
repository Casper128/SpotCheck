import { Brand } from "./Brand";
export function WorkspaceSkeleton() {
  return <main className="workspace-skeleton" aria-busy="true" aria-label="Cargando espacio de revisión">
    <header className="workspace-skeleton-header"><Brand /><span className="auth-skeleton" /></header>
    <div className="workspace-skeleton-body"><section className="workspace-skeleton-canvas"><div className="auth-skeleton" /><div className="auth-skeleton" /></section><aside className="workspace-skeleton-sidebar">{[1,2,3,4].map(item => <div className="auth-skeleton" key={item} />)}</aside></div>
  </main>;
}
