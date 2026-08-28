"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Layers, Plus, Trash2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function FlashcardNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const question = (node.attrs.question as string) ?? "";
  const answers = (node.attrs.answers as string[]) ?? [""];
  const [focused, setFocused] = useState(false);

  const isMulti = answers.length > 1;

  function setQuestion(value: string) {
    updateAttributes({ question: value });
  }

  function setAnswer(index: number, value: string) {
    const next = [...answers];
    next[index] = value;
    updateAttributes({ answers: next });
  }

  function addAnswer() {
    updateAttributes({ answers: [...answers, ""] });
  }

  function removeAnswer(index: number) {
    const next = answers.filter((_, i) => i !== index);
    updateAttributes({ answers: next.length > 0 ? next : [""] });
  }

  return (
    <NodeViewWrapper
      className={`flashcard-block ${isMulti ? "flashcard-block-multi" : "flashcard-block-simple"}`}
      contentEditable={false}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Layers className="size-3.5" />
          {isMulti ? "Flashcard · múltiplas respostas" : "Flashcard"}
        </span>
        {focused && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => deleteNode()}
            title="Excluir flashcard"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Pergunta"
        rows={1}
        className="mb-2 min-h-0 resize-none border-none bg-transparent px-0 py-0 font-medium shadow-none focus-visible:ring-0"
      />

      <div className="space-y-1.5">
        {answers.map((answer, i) => (
          <div key={i} className="flex items-start gap-1.5">
            {isMulti && <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />}
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(i, e.target.value)}
              placeholder={isMulti ? `Resposta ${i + 1}` : "Resposta"}
              rows={1}
              className="min-h-0 resize-none border-none bg-transparent px-0 py-0 text-muted-foreground shadow-none focus-visible:ring-0"
            />
            {isMulti && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeAnswer(i)}
                title="Remover resposta"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 h-6 px-1.5 text-xs text-muted-foreground"
        onClick={addAnswer}
      >
        <Plus className="size-3" /> Adicionar resposta
      </Button>
    </NodeViewWrapper>
  );
}
