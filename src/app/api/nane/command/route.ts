import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { resolveNaneCommand, suggestNoteImprovement, type NaneNoteRef } from "@/lib/nane";
import { checkPromotion, nextNoteType, NOTE_TYPE_META } from "@/lib/note-types";
import { extractFlashcards } from "@/lib/flashcards";
import { extractLinkedNoteIds, extractPlainText, type TiptapDoc } from "@/lib/doc-utils";
import { syncNoteLinks } from "@/lib/notes-service";

/**
 * Um turno de conversa com a Nane: recebe a transcrição de um comando de
 * voz (ou texto, no fallback sem reconhecimento de fala do navegador) e
 * devolve o que ela decidiu fazer. Só create_note tem efeito colateral
 * aqui dentro — open_note e promote_note só RESOLVEM qual nota é (pra
 * promote_note, a mudança de estágio de verdade é sempre feita pelo
 * cliente chamando PATCH /api/notes/[id] depois de confirmar, com todas
 * as travas de fricção do pipeline intactas).
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) return jsonError("Nada foi dito.", 400);
    const contextNoteId = typeof body.contextNoteId === "string" ? body.contextNoteId : null;

    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, title: true, type: true, plainText: true, content: true, synthesisText: true },
    });
    const noteRefs: NaneNoteRef[] = notes.map((n) => ({ id: n.id, title: n.title, type: n.type }));

    const result = await resolveNaneCommand(
      transcript,
      noteRefs,
      {
        search: async (terms) => {
          const hits = await prisma.note.findMany({
            where: {
              userId,
              OR: terms.map((t) => ({ plainText: { contains: t, mode: "insensitive" as const } })),
            },
            select: { title: true, plainText: true },
            take: 8,
          });
          return hits;
        },
      },
      contextNoteId
    );

    if (result.intent === "create_note") {
      const title = result.noteContent.length > 60 ? `${result.noteContent.slice(0, 60)}…` : result.noteContent;
      const note = await prisma.note.create({
        data: {
          title: title || "Nota sem título",
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: result.noteContent }] }],
          },
          plainText: result.noteContent,
          type: "STIMULUS",
          userId,
        },
      });
      return NextResponse.json({
        intent: "create_note",
        reply: result.reply,
        action: { type: "note_created", noteId: note.id, title: note.title },
      });
    }

    if (result.intent === "open_note") {
      return NextResponse.json({
        intent: "open_note",
        reply: result.reply,
        action: result.note ? { type: "open_note", noteId: result.note.id, title: result.note.title } : null,
      });
    }

    if (result.intent === "promote_note") {
      return NextResponse.json({
        intent: "promote_note",
        reply: result.reply,
        action:
          result.note && result.targetType
            ? {
                type: "confirm_promote",
                noteId: result.note.id,
                title: result.note.title,
                targetType: result.targetType,
              }
            : null,
      });
    }

    if (result.intent === "note_feedback") {
      if (!result.note) {
        return NextResponse.json({ intent: "note_feedback", reply: "Não achei nenhuma nota com esse nome.", action: null });
      }
      const full = notes.find((n) => n.id === result.note!.id);
      if (!full) {
        return NextResponse.json({ intent: "note_feedback", reply: "Não achei essa nota.", action: null });
      }

      const doc = full.content as TiptapDoc;
      const linkedIds = extractLinkedNoteIds(doc).filter((id) => id !== full.id);
      const linkedNotes = notes.filter((n) => linkedIds.includes(n.id));
      const hasValidOutgoingLink = linkedNotes.some(
        (n) => n.plainText.trim().length > 0 || n.type === "SYNAPSE" || n.type === "ENGRAM"
      );
      const flashcardCount = extractFlashcards(doc).length;

      const nextType = nextNoteType(full.type);
      let gapMessage: string;
      if (!nextType) {
        gapMessage = `"${full.title}" já está em Engrama, o estágio final do pipeline.`;
      } else {
        const check = checkPromotion(full.type, nextType, {
          hasValidOutgoingLink,
          synthesisText: full.synthesisText,
          flashcardCount,
          plainText: full.plainText,
        });
        gapMessage = check.ok
          ? `"${full.title}" já cumpre o requisito pra virar ${NOTE_TYPE_META[nextType].label} — é só promover.`
          : check.reason;
      }

      const tip = await suggestNoteImprovement(
        full.plainText,
        linkedNotes.map((n) => n.title)
      );

      return NextResponse.json({
        intent: "note_feedback",
        reply: tip ? `${gapMessage} ${tip}` : gapMessage,
        action: null,
      });
    }

    if (result.intent === "delete_note") {
      // Só RESOLVE e pede confirmação — quem de fato apaga é o cliente,
      // chamando o DELETE de sempre depois do usuário confirmar (sim/não
      // falado ou nos botões), igual a promote_note faz pra PATCH.
      if (!result.note) {
        return NextResponse.json({ intent: "delete_note", reply: "Não achei nenhuma nota com esse nome.", action: null });
      }
      return NextResponse.json({
        intent: "delete_note",
        reply: `Quer que eu exclua "${result.note.title}"? Isso não pode ser desfeito.`,
        action: { type: "confirm_delete", noteId: result.note.id, title: result.note.title },
      });
    }

    if (result.intent === "link_notes") {
      const { source, target } = result;
      if (!source || !target) {
        const missing = !source && !target ? "as duas notas" : !source ? "a primeira nota" : "a segunda nota";
        return NextResponse.json({ intent: "link_notes", reply: `Não achei ${missing}.`, action: null });
      }
      if (source.id === target.id) {
        return NextResponse.json({
          intent: "link_notes",
          reply: "Não dá pra linkar uma nota com ela mesma.",
          action: null,
        });
      }

      const full = notes.find((n) => n.id === source.id);
      if (!full) {
        return NextResponse.json({ intent: "link_notes", reply: "Não achei essa nota.", action: null });
      }

      const doc = full.content as TiptapDoc;
      if (extractLinkedNoteIds(doc).includes(target.id)) {
        return NextResponse.json({
          intent: "link_notes",
          reply: `"${source.title}" já está linkada com "${target.title}".`,
          action: null,
        });
      }

      const newDoc: TiptapDoc = {
        ...doc,
        content: [
          ...(doc.content ?? []),
          {
            type: "paragraph",
            content: [{ type: "wikiLink", attrs: { noteId: target.id, label: target.title } }],
          },
        ],
      };
      const newPlainText = extractPlainText(newDoc);

      await prisma.note.update({
        where: { id: source.id },
        data: { content: newDoc as unknown as Prisma.InputJsonValue, plainText: newPlainText },
      });
      await syncNoteLinks(source.id, newDoc);

      return NextResponse.json({
        intent: "link_notes",
        reply: `Linkei "${source.title}" com "${target.title}".`,
        action: null,
      });
    }

    return NextResponse.json({ intent: result.intent, reply: result.reply, action: null });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
