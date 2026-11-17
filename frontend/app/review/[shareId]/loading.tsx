import { LoaderCircle } from "lucide-react";

export default function ReviewLoading() {
  return (
    <main className="review-shell">
      <div className="review-loading"><LoaderCircle className="spin" size={20} /><span>Abriendo la revisión...</span></div>
    </main>
  );
}
