/**
 * Detecta URL de vídeo do YouTube/Vimeo e devolve a URL de embed
 * correspondente — usado tanto ao colar uma URL solta quanto ao inserir
 * pelo botão da toolbar (ver video-embed-node.ts).
 */
export type VideoProvider = "youtube" | "vimeo";
export type ParsedVideo = { provider: VideoProvider; embedUrl: string };

export function parseVideoUrl(raw: string): ParsedVideo | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id =
      u.searchParams.get("v") ??
      /^\/(?:shorts|embed|live)\/([^/?]+)/.exec(u.pathname)?.[1] ??
      null;
    if (id) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
    return null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${id}` };
    return null;
  }
  if (host === "vimeo.com") {
    const id = /^\/(\d+)/.exec(u.pathname)?.[1];
    if (id) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
    return null;
  }
  return null;
}
