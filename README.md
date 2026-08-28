# Thought Chain

Second brain pessoal — notas conectadas por wikilinks (`[[`), tags, pastas, editor rico, anexos, grafo de notas e flashcards. Inspirado no método PARA de Tiago Forte.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + TypeScript
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (sobre [Base UI](https://base-ui.com))
- [Prisma](https://www.prisma.io) + Postgres
- [Auth.js](https://authjs.dev) (Credentials, sessão JWT)
- [Tiptap](https://tiptap.dev) para o editor rico
- Cloudflare R2 (S3-compatible) para anexos
- [d3-force](https://d3js.org) para o grafo de notas

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha as variáveis (banco, `AUTH_SECRET`, usuário admin, credenciais do R2).

3. Rode a migração e o seed do usuário único:

   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```

4. Suba o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000).

## Scripts

| Script            | Descrição                                  |
| ------------------ | ------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento (Turbopack)     |
| `npm run build`     | Gera o Prisma Client e builda para produção |
| `npm run start`     | Sobe o build de produção                    |
| `npm run lint`      | ESLint                                      |
| `npm run db:seed`   | Cria/atualiza o usuário único               |
| `npm run db:migrate`| Roda `prisma migrate dev`                   |
| `npm run db:studio` | Abre o Prisma Studio                        |

## Variáveis de ambiente

Ver [`.env.example`](.env.example). Resumo:

- `DATABASE_URL` — connection string do Postgres
- `AUTH_SECRET`, `NEXTAUTH_URL` — Auth.js
- `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` — usados pelo `db:seed` pra criar o usuário único
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — Cloudflare R2 (anexos); sem essas variáveis, o upload de anexos fica desabilitado, mas o resto do app funciona normalmente

## Funcionalidades

- Notas com editor rico (Tiptap): formatação, listas, checklist, tabelas, imagens, links
- Wikilinks (`[[`) com autocomplete e criação de nota nova on-the-fly, + backlinks
- Tags e pastas aninhadas
- Busca e filtros (título/conteúdo, tags, intervalo de datas)
- Anexos de qualquer tipo de arquivo (Cloudflare R2, upload/download via URL assinada)
- Grafo de notas interativo (arrastar nós, zoom)
- Flashcards (bloco dedicado no editor) com tela de revisão filtrável por nota/pasta/tag
- Exportar nota em PDF
- Editor em tela cheia
- Tema claro/escuro
- Perfil: avatar, nome, usuário e senha
