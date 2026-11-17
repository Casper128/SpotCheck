import { AccessGate } from "@/presentation/auth/AccessGate";
import ReviewPage from "@/presentation/pages/ReviewPage";
export default async function Page({ params }: { readonly params: Promise<{ readonly shareId: string }> }) {
  const { shareId } = await params;
  return <AccessGate><ReviewPage shareId={shareId} /></AccessGate>;
}
