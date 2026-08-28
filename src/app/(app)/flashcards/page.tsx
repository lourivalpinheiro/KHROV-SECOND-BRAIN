import { Layers } from "lucide-react";
import { FlashcardsView } from "@/components/flashcards-view";

export default function FlashcardsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-6 py-3">
        <h1 className="text-lg font-semibold">Flashcards</h1>
        <p className="text-sm text-muted-foreground">
          Crie flashcards em qualquer nota pelo ícone de flashcard (
          <Layers className="inline size-3.5 align-text-bottom" />) na barra de ferramentas do
          editor.
        </p>
      </div>
      <FlashcardsView />
    </div>
  );
}
