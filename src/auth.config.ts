import type { NextAuthConfig } from "next-auth";

/**
 * Configuração "edge-safe": nada aqui pode importar Prisma/bcrypt, porque o
 * middleware roda no Edge Runtime da Vercel (que tem um limite de tamanho de
 * bundle bem apertado — 1MB no plano free). O provider de Credentials (que
 * usa Prisma pra checar a senha) fica só em src/auth.ts, importado apenas
 * pelas rotas de API/Server Components (runtime Node.js normal).
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      // Disparado por `update()` no client (ex: depois de editar o perfil), pra
      // atualizar o JWT sem precisar deslogar/logar de novo.
      if (trigger === "update" && session) {
        const patch = session as Partial<{ name: string; email: string; image: string | null }>;
        if (typeof patch.name === "string") token.name = patch.name;
        if (typeof patch.email === "string") token.email = patch.email;
        if (typeof patch.image === "string" || patch.image === null) token.picture = patch.image;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
