import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutNodeView, type CalloutVariant } from "./callout-node-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /** Envolve o(s) bloco(s) selecionados (ou o parágrafo atual, se não houver seleção) numa caixa de callout. */
      setCallout: (attrs?: { variant?: CalloutVariant }) => ReturnType;
    };
  }
}

/**
 * Callout: caixa de destaque com ícone/cor (aviso, dica, info, perigo,
 * nota) — conteúdo rico de verdade (parágrafos, listas), não só texto
 * puro. Ver CalloutNodeView pro visual e o troca-variant.
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: { default: "info" },
      /** Ícone escolhido à parte da cor — null = usa o ícone padrão da variant (ver CALLOUT_ICONS em callout-node-view.tsx). */
      icon: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
    };
  },
});
