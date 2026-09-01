import { SermonEditor } from "@/components/espiritual/sermon-editor";

export default async function SermonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // key={id} força remontar o editor ao trocar de sermão — mesma razão do NoteEditor.
  return <SermonEditor key={id} sermonId={id} />;
}
