import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { BookmarkNodeView } from "./bookmark-node-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      insertBookmark: (attrs: { url: string }) => ReturnType;
    };
  }
}

const BARE_URL_RE = /^https?:\/\/\S+$/i;

/**
 * Bookmark: cola uma URL sozinha (nada mais selecionado) e ela vira um
 * cartão clicável com título/descrição/imagem, em vez de só texto azul
 * sublinhado. Prévia buscada uma vez (client → /api/link-preview) e
 * guardada nos atributos do node, pra não rebuscar toda hora.
 */
export const Bookmark = Node.create({
  name: "bookmark",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: null },
      description: { default: null },
      image: { default: null },
      favicon: { default: null },
      loaded: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="bookmark"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const url = String(node.attrs.url ?? "");
    const label = String(node.attrs.title || url);
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "bookmark",
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      label,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkNodeView);
  },

  addCommands() {
    return {
      insertBookmark:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { url: attrs.url } })
            .run(),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("bookmarkPaste"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text || !BARE_URL_RE.test(text)) return false;
            // Se tinha texto selecionado, o usuário provavelmente queria
            // "colar como link nesse texto" — deixa o comportamento padrão
            // do Link/autolink cuidar disso, não substitui por um bloco.
            if (!view.state.selection.empty) return false;

            const node = view.state.schema.nodes.bookmark.create({ url: text });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
            return true;
          },
        },
      }),
    ];
  },
});
