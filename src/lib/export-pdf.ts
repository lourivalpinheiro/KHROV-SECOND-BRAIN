function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PdfSection = { id: string; title: string; html: string };

const STYLE = `
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.65;
    font-size: 14px;
  }
  section.pdf-note {
    max-width: 720px;
    margin: 2.5rem auto;
    padding: 0 1.5rem;
  }
  section.pdf-note + section.pdf-note { break-before: page; }
  h1.note-title { font-size: 1.9rem; margin: 0 0 0.5rem; font-weight: 700; }
  p.note-kicker { margin: 0 0 1.5rem; font-size: 0.8rem; color: #888; }
  p.note-kicker a { color: #888; text-decoration: underline; }
  h1, h2, h3 { margin-top: 1.4em; margin-bottom: 0.5em; }
  p { margin: 0.6em 0; }
  a { color: #2563eb; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  td, th { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
  th { background: #f5f5f5; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  ul[data-type="taskList"] li { display: flex; gap: 0.5rem; align-items: flex-start; }
  img { max-width: 100%; border-radius: 4px; }
  blockquote { border-left: 3px solid #ccc; margin: 1rem 0; padding-left: 1rem; color: #555; }
  code { background: #f2f2f2; padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f2f2f2; padding: 0.75rem; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  a.wiki-link { color: #2563eb; font-weight: 600; text-decoration: none; }
  a.wiki-link::after { content: " ↴"; }
  span[data-type="wiki-link"] { color: #2563eb; font-weight: 600; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5rem 0; }
  @page { margin: 1.5cm; }
`;

/**
 * Exporta uma ou mais notas como PDF (impressão nativa do navegador). Cada
 * seção vira sua própria página. Wikilinks dentro do texto que apontam pra
 * uma nota incluída no export viram links internos clicáveis (âncora #note-
 * <id>); os que apontam pra fora do que foi incluído ficam como texto
 * estático, do jeito que já eram.
 */
export function exportNotesToPdf(sections: PdfSection[]) {
  if (sections.length === 0) return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  const includedIds = new Set(sections.map((s) => s.id));
  const mainTitle = escapeHtml(sections[0].title || "Nota sem título");

  const body = sections
    .map((s, i) => {
      const safeTitle = escapeHtml(s.title || "Nota sem título");
      const kicker =
        i === 0
          ? ""
          : `<p class="note-kicker"><a href="#note-${sections[0].id}">← ${mainTitle}</a> · nota conectada</p>`;
      return `<section class="pdf-note" id="note-${s.id}">
        <h1 class="note-title">${safeTitle}</h1>
        ${kicker}
        ${s.html}
      </section>`;
    })
    .join("\n");

  doc.open();
  doc.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${mainTitle}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`);
  doc.close();

  // Wikilinks que apontam pra uma nota incluída no export viram <a href="#note-id">
  // (navegação interna do PDF); os que apontam pra fora ficam como estavam.
  doc.querySelectorAll('span[data-type="wiki-link"]').forEach((span) => {
    const targetId = span.getAttribute("data-note-id");
    if (!targetId || !includedIds.has(targetId)) return;
    const a = doc.createElement("a");
    a.setAttribute("href", `#note-${targetId}`);
    a.className = "wiki-link";
    a.innerHTML = span.innerHTML;
    span.replaceWith(a);
  });

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}

/** Exporta uma única nota, sem conexões — usado quando não há nada conectado. */
export function exportNoteToPdf(title: string, contentHtml: string) {
  exportNotesToPdf([{ id: "main", title, html: contentHtml }]);
}
