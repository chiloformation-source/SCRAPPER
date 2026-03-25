import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 est un module natif Node.js, il ne peut pas être bundlé
  serverExternalPackages: ["better-sqlite3", "puppeteer-core"],

  // Turbopack est activé par défaut dans Next.js 16
  turbopack: {},

  // Autoriser l'accès HMR depuis l'outil de preview
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
