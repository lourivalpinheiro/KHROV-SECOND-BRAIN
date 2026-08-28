function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Exporta o conteúdo de uma nota como PDF usando a caixa de diálogo nativa de
 * impressão do navegador (o usuário escolhe "Salvar como PDF" como destino).
 * Renderiza em um iframe isolado para não depender do layout/scroll do app.
 */
export function exportNoteToPdf(title: string, contentHtml: string) {
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

  const safeTitle = escapeHtml(title || "Nota sem título");

  doc.open();
  doc.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif;
    color: #1a1a1a;
    max-width: 720px;
    margin: 2.5rem auto;
    padding: 0 1.5rem;
    line-height: 1.65;
    font-size: 14px;
  }
  h1.note-title { font-size: 1.9rem; margin: 0 0 1.5rem; font-weight: 700; }
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
  span[data-type="wiki-link"] { color: #2563eb; font-weight: 600; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5rem 0; }
  @page { margin: 1.5cm; }
</style>
</head>
<body>
  <h1 class="note-title">${safeTitle}</h1>
  ${contentHtml}
</body>
</html>`);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}
