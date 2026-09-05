import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { VideoEmbedNodeView } from "./video-embed-node-view";
import { parseVideoUrl } from "@/lib/video-embed";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      insertVideoEmbed: (attrs: { url: string }) => ReturnType;
    };
  }
}

/**
 * Vídeo incorporado (YouTube/Vimeo) — cola uma URL sozinha (nada
 * selecionado) e ela vira um player embutido, em vez de um bookmark
 * genérico. Precisa vir ANTES de Bookmark na lista de extensões: os dois
 * têm handlePaste pra URL solta, e o ProseMirror testa em ordem, parando
 * no primeiro que aceitar — vídeo primeiro garante que ele "ganha" de
 * bookmark pras URLs que reconhece, deixando o resto pro bookmark.
 */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      url: { default: "" },
      provider: { default: null },
      embedUrl: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="video-embed"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const url = String(node.attrs.url ?? "");
    const embedUrl = String(node.attrs.embedUrl ?? "");
    // Usado fora do editor vivo (generateHTML: export de PDF, linha do
    // tempo, página pública de nota) — sem isso virava uma div vazia,
    // já que quem renderiza de verdade dentro do editor é o NodeView
    // React (addNodeView), que generateHTML nunca chama.
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "video-embed", class: "video-embed-export" }),
      embedUrl
        ? ["iframe", { src: embedUrl, class: "video-embed-export-frame", allowfullscreen: "true" }]
        : ["a", { href: url, target: "_blank", rel: "noopener noreferrer" }, url],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedNodeView);
  },

  addCommands() {
    return {
      insertVideoEmbed:
        (attrs) =>
        ({ chain }) => {
          const parsed = parseVideoUrl(attrs.url);
          if (!parsed) return false;
          return chain()
            .insertContent({
              type: this.name,
              attrs: { url: attrs.url, provider: parsed.provider, embedUrl: parsed.embedUrl },
            })
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("videoEmbedPaste"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text) return false;
            if (!view.state.selection.empty) return false;
            const parsed = parseVideoUrl(text);
            if (!parsed) return false;

            const node = view.state.schema.nodes.videoEmbed.create({
              url: text,
              provider: parsed.provider,
              embedUrl: parsed.embedUrl,
            });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
            return true;
          },
        },
      }),
    ];
  },
});
