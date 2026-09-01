import { PrismaClient, NoteType } from "@prisma/client";

const prisma = new PrismaClient();

// Mesma ordem de src/lib/note-types.ts — duplicado aqui só pra este script
// não depender de alias de path (@/) fora do runtime do Next.js.
const PIPELINE: NoteType[] = ["STIMULUS", "POTENTIATION", "SYNAPSE", "ENGRAM"];

/**
 * Backfill único: preenche uma "linha do tempo" aproximada pras notas que
 * JÁ estavam além de Estímulo quando a feature de NoteStageHistory foi
 * ligada — sem isso, elas nunca teriam entrada nenhuma (o hook real só
 * roda em PROMOÇÕES daqui pra frente). Não existe conteúdo real de como
 * elas eram em cada estágio anterior (nunca foi capturado), então usa o
 * content ATUAL como aproximação — UMA entrada por nota, rotulada com o
 * estágio imediatamente anterior ao atual, marcada isEstimate=true (a UI
 * mostra isso, não finge que é histórico de verdade).
 *
 * Idempotente: só olha notas com ZERO linhas em NoteStageHistory, então
 * rodar de novo depois não duplica nada.
 */
async function main() {
  const notes = await prisma.note.findMany({
    where: {
      type: { in: ["POTENTIATION", "SYNAPSE", "ENGRAM"] },
      stageHistory: { none: {} },
    },
    select: { id: true, type: true, content: true },
  });

  console.log(`${notes.length} nota(s) sem linha do tempo, já além de Estímulo.`);

  for (const note of notes) {
    const idx = PIPELINE.indexOf(note.type);
    const previousStage = PIPELINE[idx - 1];
    if (!previousStage) continue; // não deveria acontecer (STIMULUS é filtrado no where), defensivo só

    await prisma.noteStageHistory.create({
      data: {
        noteId: note.id,
        stage: previousStage,
        content: note.content as object,
        isEstimate: true,
      },
    });
  }

  console.log("Backfill concluído.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
