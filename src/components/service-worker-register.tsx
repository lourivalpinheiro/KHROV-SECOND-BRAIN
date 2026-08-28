"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (public/sw.js) que cacheia páginas e leituras de
 * API já visitadas, pra dar pra abrir notas offline. Só em produção — em dev
 * um SW cacheado atrapalha o hot reload do Turbopack.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline é um extra — nunca deve quebrar o app se o registro falhar.
    });
  }, []);

  return null;
}
