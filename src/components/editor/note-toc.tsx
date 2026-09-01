"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";

type Heading = { level: number; text: string; pos: number };

function computeHeadings(editor: Editor): Heading[] {
  const headings: Heading[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (text) headings.push({ level: Number(node.attrs.level) || 1, text, pos: offset });
  });
  return headings;
}

/**
 * Sumário flutuante da nota — lista os títulos (H1/H2/H3) e pula direto
 * pra eles ao clicar, pra não ter que rolar a nota inteira pra achar uma
 * seção. Some sozinho em notas com menos de 2 títulos (não tem o que
 * navegar) e em telas estreitas (não tem espaço sobrando do lado do
 * editor sem atrapalhar).
 */
export function NoteToc({ editor }: { editor: Editor | null }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  // Colapsado por padrão — é consulta, não algo que precisa ocupar espaço
  // toda vez que a nota abre. Quem quiser navegar pelos títulos, expande.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!editor) return;
    function sync() {
      if (editor) setHeadings(computeHeadings(editor));
    }
    sync();
    editor.on("update", sync);
    return () => {
      editor.off("update", sync);
    };
  }, [editor]);

  if (!editor || headings.length < 2) return null;

  function goTo(pos: number) {
    if (!editor) return;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav
      aria-label="Sumário da nota"
      className="fixed top-24 right-4 z-20 hidden max-h-[60vh] w-48 overflow-y-auto rounded-lg border bg-card/95 p-2 text-xs shadow-sm backdrop-blur xl:block"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-1 py-0.5 text-muted-foreground hover:text-foreground"
      >
        <List className="size-3.5" />
        <span className="font-medium">Sumário</span>
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5">
          {headings.map((h, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => goTo(h.pos)}
                className="block w-full truncate rounded px-1.5 py-1 text-left text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                style={{ paddingLeft: `${(h.level - minLevel) * 10 + 6}px` }}
                title={h.text}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
