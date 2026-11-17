import { AuthProvider } from "@/presentation/auth/AuthProvider";
import type { Metadata } from "next";
import "@/presentation/styles/globals.css";

export const metadata: Metadata = {
  title: "Mr. Mamba Review — Feedback de tu equipo",
  description: "Comparte páginas e imágenes y recoge comentarios justo donde importan.",
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full font-sans"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
