import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata = {
  title: "Google Tasks AI",
  description: "Gestion intelligente de tâches Google avec l'IA",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
