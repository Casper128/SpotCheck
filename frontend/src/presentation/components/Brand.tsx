import Link from "next/link";
export function Brand({ className = "auth-brand" }: { readonly className?: string }) {
  return <Link className={className} href="/" aria-label="Mr. Mamba Review · Proyectos"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-wordmark">MR. MAMBA<small>REVIEW</small></span></Link>;
}
