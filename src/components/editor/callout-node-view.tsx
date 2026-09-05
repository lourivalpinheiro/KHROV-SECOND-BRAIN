"use client";

import { useState } from "react";
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { AlertTriangle, Info, Lightbulb, ShieldAlert, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CALLOUT_VARIANTS = {
  info: {
    icon: Info,
    label: "Info",
    className: "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    label: "Aviso",
    className: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  danger: {
    icon: ShieldAlert,
    label: "Perigo",
    className: "border-destructive/50 bg-destructive/10 text-destructive",
  },
  tip: {
    icon: Lightbulb,
    label: "Dica",
    className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  note: {
    icon: StickyNote,
    label: "Nota",
    className: "border-muted-foreground/40 bg-muted/50 text-muted-foreground",
  },
} as const;

export type CalloutVariant = keyof typeof CALLOUT_VARIANTS;

/**
 * Callout: caixa colorida com ícone pra destacar um aviso/dica/nota no
 * meio do texto — conteúdo rico de verdade dentro (NodeViewContent, não
 * um textarea), pode ter parágrafos, listas etc. A cor/ícone (variant)
 * troca clicando nos botões que só aparecem com o bloco focado, mesmo
 * padrão de "controles só ao focar" do FlashcardNodeView.
 */
export function CalloutNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const variant = ((node.attrs.variant as string) in CALLOUT_VARIANTS ? node.attrs.variant : "info") as CalloutVariant;
  const [focused, setFocused] = useState(false);
  const meta = CALLOUT_VARIANTS[variant];
  const Icon = meta.icon;

  return (
    <NodeViewWrapper
      className={cn("callout-block not-prose my-2 flex gap-2 rounded-lg border-l-4 p-3", meta.className)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <span contentEditable={false} className="mt-0.5 shrink-0">
        <Icon className="size-4" />
      </span>
      <NodeViewContent className="min-w-0 flex-1 text-sm text-foreground [&_p]:my-0" />
      {focused && (
        <div contentEditable={false} className="flex shrink-0 items-start gap-0.5">
          {(Object.keys(CALLOUT_VARIANTS) as CalloutVariant[]).map((key) => {
            const VariantIcon = CALLOUT_VARIANTS[key].icon;
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="icon-xs"
                className={cn("text-muted-foreground", variant === key && "bg-accent text-foreground")}
                title={CALLOUT_VARIANTS[key].label}
                onClick={() => updateAttributes({ variant: key })}
              >
                <VariantIcon className="size-3.5" />
              </Button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive"
            title="Excluir callout"
            onClick={() => deleteNode()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
