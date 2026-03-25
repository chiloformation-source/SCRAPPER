import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "ScraperPro - Intelligence Commerciale",
  description: "Logiciel interne de scraping et prospection d'entreprises",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="h-full flex flex-col bg-background font-sans overflow-hidden">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
