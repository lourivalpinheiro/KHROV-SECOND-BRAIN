import { ImageResponse } from "next/og";

/**
 * Gera o favicon do módulo (mesmo glifo "brain circuit" da logo, só troca
 * a cor de fundo) — usado pelos icon.tsx de cada módulo (ver
 * saude/icon.tsx e financeiro/icon.tsx) pra a aba do navegador também
 * mudar de cor, não só o conteúdo da página. Notas usa o icon.png
 * estático da raiz, sem precisar disso.
 */
export const APP_ICON_SIZE = { width: 32, height: 32 };
export const APP_ICON_CONTENT_TYPE = "image/png";

export function generateAppIcon(bgColor: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bgColor,
          borderRadius: 7,
        }}
      >
        {/* Mesmo ícone "brain-circuit" da lucide-react usado na logo da sidebar. */}
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path d="M9 13a4.5 4.5 0 0 0 3-4" />
          <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
          <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
          <path d="M6 18a4 4 0 0 1-1.967-.516" />
          <path d="M12 13h4" />
          <path d="M12 18h6a2 2 0 0 1 2 2v1" />
          <path d="M12 8h8" />
          <path d="M16 8V5a2 2 0 0 1 2-2" />
          <circle cx="16" cy="13" r="1" fill="white" />
          <circle cx="18" cy="3" r="1" fill="white" />
          <circle cx="20" cy="21" r="1" fill="white" />
          <circle cx="20" cy="8" r="1" fill="white" />
        </svg>
      </div>
    ),
    { ...APP_ICON_SIZE }
  );
}
