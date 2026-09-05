import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileEmbedNodeView } from "./file-embed-node-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileEmbed: {
      insertFileEmbed: (attrs: { attachmentId: string; filename: string; mimeType: string; size: number }) => ReturnType;
    };
  }
}

/**
 * Arquivo incorporado no corpo — ver FileEmbedNodeView. O upload em si
 * (signed URL do Supabase Storage + POST /api/attachments) acontece no
 * botão da toolbar, que só insere este node depois do Attachment já
 * existir no banco.
 */
export const FileEmbed = Node.create({
  name: "fileEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  isolating: true,

  addAttributes() {
    return {
      attachmentId: { default: "" },
      filename: { default: "" },
      mimeType: { default: "" },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-embed"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-embed", "data-attachment-id": String(node.attrs.attachmentId ?? "") }),
      String(node.attrs.filename ?? ""),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileEmbedNodeView);
  },

  addCommands() {
    return {
      insertFileEmbed:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
