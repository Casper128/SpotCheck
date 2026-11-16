import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpotCheck — Feedback visual para tu equipo",
  description: "Comparte páginas e imágenes y recoge comentarios justo donde importan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
