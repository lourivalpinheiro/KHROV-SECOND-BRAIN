import { PocketDetail } from "@/components/financeiro/pocket-detail";

export default async function CofrinhoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PocketDetail pocketId={id} />;
}
