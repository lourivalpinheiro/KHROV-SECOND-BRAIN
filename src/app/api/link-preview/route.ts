import { NextRequest, NextResponse } from "next/server";
import { requireUserId, jsonError } from "@/lib/api-utils";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 500_000; // não baixa a página inteira se for enorme — só o começo já tem o <head>

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

function pick(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return null;
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

/**
 * Prévia de link pra virar um bookmark clicável na nota — pega
 * título/descrição/imagem/favicon via meta tags Open Graph, sem depender
 * de nenhum serviço de terceiros (só um fetch + regex no HTML da própria
 * página). Bloqueia esquemas fora de http/https e hosts que parecem
 * endereços internos/privados (mitigação básica de SSRF — a página é
 * escolhida pelo próprio usuário, não por conteúdo de terceiros).
 */
export async function GET(req: NextRequest) {
  try {
    await requireUserId();
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return jsonError("URL obrigatória.", 400);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return jsonError("URL inválida.", 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return jsonError("Só URLs http/https.", 400);
    }
    if (isBlockedHost(parsed.hostname)) {
      return jsonError("Esse endereço não pode ser pré-visualizado.", 400);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let html: string;
    let contentType: string;
    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KhrovLinkPreview/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) return jsonError("Não consegui acessar essa página.", 502);
      contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return NextResponse.json({
          url: parsed.toString(),
          title: parsed.hostname,
          description: null,
          image: null,
          favicon: `${parsed.origin}/favicon.ico`,
        });
      }
      // Lê só os primeiros bytes — o <head> com as meta tags vem sempre no
      // começo do documento, não precisa da página inteira.
      const reader = res.body?.getReader();
      if (!reader) {
        html = await res.text();
      } else {
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < MAX_HTML_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            total += value.length;
          }
        }
        reader.cancel().catch(() => {});
        html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
      }
    } catch {
      return jsonError("Não consegui acessar essa página.", 502);
    } finally {
      clearTimeout(timer);
    }

    const title =
      pick(html, [
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
        /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
        /<title[^>]*>([^<]*)<\/title>/i,
      ]) ?? parsed.hostname;

    const description = pick(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ]);

    let image = pick(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i,
    ]);
    if (image) {
      try {
        image = new URL(image, parsed.origin).toString();
      } catch {
        image = null;
      }
    }

    const favicon = pick(html, [
      /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']*)["']/i,
      /<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i,
    ]);
    let faviconUrl = `${parsed.origin}/favicon.ico`;
    if (favicon) {
      try {
        faviconUrl = new URL(favicon, parsed.origin).toString();
      } catch {
        // mantém o default
      }
    }

    return NextResponse.json({
      url: parsed.toString(),
      title: title.slice(0, 200),
      description: description ? description.slice(0, 300) : null,
      image,
      favicon: faviconUrl,
    });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
