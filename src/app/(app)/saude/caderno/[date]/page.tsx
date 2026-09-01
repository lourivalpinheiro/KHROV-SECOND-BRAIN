import { FolhaEditor } from "@/components/saude/folha-editor";

export default async function FolhaPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  // key={date} força remontar ao trocar de folha (prev/next) — mesmo motivo
  // do editor de notas: sem isso, o debounce do autosave da folha anterior
  // podia vazar pra folha nova.
  return <FolhaEditor key={date} date={date} />;
}
