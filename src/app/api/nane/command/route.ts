import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, jsonError } from "@/lib/api-utils";
import { resolveNaneCommand, type NaneNoteRef } from "@/lib/nane";

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

    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, title: true, type: true, plainText: true },
    });
    const noteRefs: NaneNoteRef[] = notes.map((n) => ({ id: n.id, title: n.title, type: n.type }));

    const result = await resolveNaneCommand(transcript, noteRefs, {
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
    });

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

    return NextResponse.json({ intent: result.intent, reply: result.reply, action: null });
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }
}
