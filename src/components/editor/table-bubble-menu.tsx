"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns3,
  Rows3,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Action({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={destructive ? "size-8 text-destructive hover:text-destructive" : "size-8"}
            onClick={onClick}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Menu flutuante que aparece com o cursor dentro de uma tabela, pra
 * adicionar/remover linhas e colunas sem precisar de atalho de teclado.
 */
export function TableBubbleMenu({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="table-bubble-menu"
      shouldShow={({ editor }) => editor.isActive("table")}
      options={{ placement: "top-start", offset: 8 }}
      className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
    >
      <Action label="Adicionar coluna antes" onClick={() => editor.chain().focus().addColumnBefore().run()}>
        <ArrowLeftToLine />
      </Action>
      <Action label="Adicionar coluna depois" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <ArrowRightToLine />
      </Action>
      <Action label="Excluir coluna" onClick={() => editor.chain().focus().deleteColumn().run()} destructive>
        <Columns3 />
      </Action>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Action label="Adicionar linha antes" onClick={() => editor.chain().focus().addRowBefore().run()}>
        <ArrowUpToLine />
      </Action>
      <Action label="Adicionar linha depois" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <ArrowDownToLine />
      </Action>
      <Action label="Excluir linha" onClick={() => editor.chain().focus().deleteRow().run()} destructive>
        <Rows3 />
      </Action>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Action label="Excluir tabela" onClick={() => editor.chain().focus().deleteTable().run()} destructive>
        <Trash2 />
      </Action>
    </BubbleMenu>
  );
}
