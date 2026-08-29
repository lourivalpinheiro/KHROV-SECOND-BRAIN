import { NoteEditor } from "@/components/editor/note-editor";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // key={id} força remontar o editor ao trocar de nota — sem isso, o mesmo
  // componente (e o timer de autosave debounced dele) sobrevivia entre notas
  // diferentes, podendo cancelar um salvamento pendente da nota anterior.
  return <NoteEditor key={id} noteId={id} />;
}
