import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Instância separada (sem o provider de Credentials/Prisma) só pra checar a
// sessão no middleware — mantém o bundle da Edge Function pequeno o
// suficiente pro limite de 1MB da Vercel. A instância completa, com login
// de verdade, é a de src/auth.ts (usada nas rotas de API/Server Components).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isAuthRoute = pathname === "/login";
  const isApiAuthRoute = pathname.startsWith("/api/auth");
  // O Vercel Cron chama essas rotas direto, sem cookie de sessão nenhum —
  // sem essa exceção, o middleware redirecionava a chamada pra /login antes
  // dela sequer chegar no handler, e o cron nunca rodava de verdade. A
  // autenticação de quem chama é feita dentro da própria rota, via
  // CRON_SECRET (ver src/app/api/cron/purge-trash/route.ts).
  const isApiCronRoute = pathname.startsWith("/api/cron/");

  if (isApiAuthRoute || isApiCronRoute) return NextResponse.next();

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/notes", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Ícones, manifest e o service worker precisam ficar acessíveis sem sessão
  // — são buscados pelo navegador/SO na instalação como PWA (ou registro do
  // SW), antes (ou independente) do login.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|icons/|sw.js|offline.html).*)",
  ],
};
