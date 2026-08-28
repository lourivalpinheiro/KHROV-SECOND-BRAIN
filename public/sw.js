// Service worker do Khrov — cache pra ler notas já visitadas offline.
// Escopo deliberadamente pequeno: só leitura (GET). Criar/editar/excluir
// nota exige rede, do jeito que já era (o navegador acusa erro normalmente).
//
// Bump nessa versão sempre que a lógica de cache abaixo mudar, pra forçar
// os clientes a trocarem de cache em vez de ficarem presos no antigo.
const CACHE_NAME = "khrov-v1";

const APP_SHELL = ["/offline.html", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Só GET same-origin passa pelo cache — mutações e chamadas externas vão
  // direto pra rede, sem interferência.
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  // Navegação entre páginas (abrir uma nota, trocar de rota): tenta a rede,
  // cai pra versão em cache dessa mesma página, e por último a página de
  // "offline" genérica se essa URL nunca foi visitada.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/offline.html"));
    return;
  }

  // Assets do Next com hash no nome — imutáveis, pode servir do cache direto.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Leituras de API (notas, pastas, tags, flashcards...): tenta a rede pra
  // pegar dado fresco, cai pro último resultado salvo se estiver offline.
  // Fica de fora: /api/auth (sessão) e /api/export (dump grande, sem valor
  // em cache).
  if (
    url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/api/auth") &&
    url.pathname !== "/api/export"
  ) {
    event.respondWith(networkFirst(request));
    return;
  }
});
