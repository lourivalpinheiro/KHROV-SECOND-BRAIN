import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Detecta quando a conexão cai e refaz sozinho a navegação/Server Action
  // pendente quando ela volta, em vez de só quebrar. Não cobre abrir o app
  // já offline (isso é o service worker em public/sw.js).
  experimental: {
    useOffline: true,
  },
};

export default nextConfig;
