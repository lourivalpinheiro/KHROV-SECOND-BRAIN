import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { fetcher } from "@/lib/api-client";
import { WikiLinkNodeView } from "./wiki-link-node-view";
import { WikiLinkList, type WikiLinkSuggestionItem } from "./wiki-link-list";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      insertWikiLink: (attrs: { noteId: string; label: string }) => ReturnType;
    };
  }
}

export function createWikiLinkExtension(currentNoteId?: string) {
  return Node.create({
    name: "wikiLink",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        noteId: { default: null },
        label: { default: "" },
      };
    },

    parseHTML() {
      return [{ tag: 'span[data-type="wiki-link"]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          "data-type": "wiki-link",
          "data-note-id": node.attrs.noteId,
        }),
        `[[${node.attrs.label}]]`,
      ];
    },

    addNodeView() {
      return ReactNodeViewRenderer(WikiLinkNodeView);
    },

    addCommands() {
      return {
        insertWikiLink:
          (attrs) =>
          ({ chain }) =>
            chain().insertContent({ type: this.name, attrs }).run(),
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "[[",
          allowSpaces: true,
          startOfLine: false,
          items: async ({ query }: { query: string }): Promise<WikiLinkSuggestionItem[]> => {
            const q = query.trim();
            if (!q) return [];

            const notes = await fetcher<{ id: string; title: string }[]>(
              `/api/notes/search?q=${encodeURIComponent(q)}${
                currentNoteId ? `&excludeId=${currentNoteId}` : ""
              }`
            );

            const items: WikiLinkSuggestionItem[] = notes.map((n) => ({
              noteId: n.id,
              label: n.title,
            }));

            const hasExact = notes.some((n) => n.title.toLowerCase() === q.toLowerCase());
            if (!hasExact) {
              items.push({ noteId: null, label: q, isNew: true });
            }

            return items;
          },
          command: ({ editor, range, props }) => {
            const attrs = props as { noteId: string; label: string };
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: "wikiLink", attrs },
                { type: "text", text: " " },
              ])
              .run();
          },
          render: () => {
            let component: ReactRenderer<
              { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
              { items: WikiLinkSuggestionItem[]; command: (attrs: { noteId: string; label: string }) => void }
            >;
            let popup: TippyInstance[];

            return {
              onStart: (props) => {
                component = new ReactRenderer(WikiLinkList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },
              onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },
              onKeyDown(props) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component.ref?.onKeyDown(props) ?? false;
              },
              onExit() {
                popup?.[0]?.destroy();
                component.destroy();
              },
            };
          },
        }),
      ];
    },
  });
}
