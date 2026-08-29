"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { mutate } from "swr";
import { Bot, X, Check, Loader2, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJSON, patchJSON, deleteJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_TYPE_META } from "@/lib/note-types";

type Phase = "idle" | "thinking" | "confirm";
type ChatMessage = { role: "user" | "nane"; text: string };
type PendingConfirm =
  | { kind: "promote"; noteId: string; title: string; targetType: string }
  | { kind: "delete"; noteId: string; title: string };

/**
 * Nane — assistente do Khrov, só por texto (a versão por voz foi removida:
 * o reconhecimento de fala contínuo do navegador reagia a qualquer ruído
 * de fundo, e mesmo com push-to-talk + medidor de volume a experiência
 * ficava instável no mobile). Ícone discreto no cabeçalho, abre um painel
 * de chat — mesma inteligência de antes (POST /api/nane/command), só que
 * digitando em vez de falando.
 */
export function NaneAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const pendingConfirmRef = useRef<PendingConfirm | null>(null);

  useEffect(() => {
    pendingConfirmRef.current = pendingConfirm;
  }, [pendingConfirm]);

  const say = useCallback((text: string) => {
    setMessages((m) => [...m, { role: "nane", text }]);
  }, []);

  const handleAction = useCallback(
    async (action: { type: string; noteId?: string; title?: string; targetType?: string } | null) => {
      if (action?.type === "note_created" || action?.type === "open_note") {
        if (action.noteId) {
          await mutate("/api/notes");
          router.push(`/notes/${action.noteId}`);
        }
      } else if (action?.type === "confirm_promote" && action.noteId && action.title && action.targetType) {
        setPendingConfirm({ kind: "promote", noteId: action.noteId, title: action.title, targetType: action.targetType });
        setPhase("confirm");
        return;
      } else if (action?.type === "confirm_delete" && action.noteId && action.title) {
        setPendingConfirm({ kind: "delete", noteId: action.noteId, title: action.title });
        setPhase("confirm");
        return;
      }
      setPhase("idle");
    },
    [router]
  );

  const runCommand = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) return;
      setOpen(true);
      setMessages((m) => [...m, { role: "user", text }]);
      setPhase("thinking");
      try {
        // Se o usuário está numa nota agora, "essa nota"/"nota atual" na
        // mensagem se refere a ela — sem isso, a Nane não tem como saber qual.
        const contextNoteId = pathname?.match(/^\/notes\/([^/]+)/)?.[1] ?? null;
        const result = await postJSON<{ reply: string; action: { type: string; [k: string]: unknown } | null }>(
          "/api/nane/command",
          { transcript: text, contextNoteId }
        );
        say(result.reply);
        await handleAction(result.action as never);
      } catch (err) {
        say(err instanceof Error ? err.message : "Deu um erro aqui, tenta de novo.");
        setPhase("idle");
      }
    },
    [handleAction, say, pathname]
  );

  const resolveConfirm = useCallback(
    async (accepted: boolean) => {
      const pending = pendingConfirmRef.current;
      setPendingConfirm(null);
      if (!pending) {
        setPhase("idle");
        return;
      }
      if (!accepted) {
        say("Beleza, não mexi em nada.");
        setPhase("idle");
        return;
      }
      setPhase("thinking");
      try {
        if (pending.kind === "promote") {
          await patchJSON(`/api/notes/${pending.noteId}`, { type: pending.targetType });
          await mutate("/api/notes");
          const label = NOTE_TYPE_META[pending.targetType as keyof typeof NOTE_TYPE_META]?.label ?? pending.targetType;
          say(`Pronto — "${pending.title}" agora é ${label}.`);
        } else {
          await deleteJSON(`/api/notes/${pending.noteId}`);
          await mutate("/api/notes");
          say(`Prontinho, excluí "${pending.title}".`);
          if (pathname === `/notes/${pending.noteId}`) router.push("/notes");
        }
      } catch (err) {
        // A trava de fricção do pipeline continua valendo mesmo por aqui —
        // se o PATCH recusar, a Nane só repassa o motivo, não força nada.
        say(err instanceof Error ? err.message : "Não consegui fazer isso agora.");
      } finally {
        setPhase("idle");
      }
    },
    [say, pathname, router]
  );

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");
    runCommand(text);
  }

  const isThinking = phase === "thinking";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          if (open) {
            if (minimized) setMinimized(false);
            else setOpen(false);
            return;
          }
          setMinimized(false);
          setOpen(true);
        }}
        title="Conversar com a Nane"
        className="size-8"
      >
        <Bot className="size-4" />
      </Button>

      {open && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed top-16 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs shadow-lg"
        >
          {isThinking ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Bot className="size-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate">{messages[messages.length - 1]?.text ?? "Nane"}</span>
        </button>
      )}

      {open && !minimized && (
        <div className="fixed top-16 left-1/2 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Nane</span>
              {isThinking && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                title="Minimizar (continua a conversa)"
                onClick={() => setMinimized(true)}
              >
                <Minus className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <p className="text-muted-foreground">
                Escreva pra Nane: ditar uma nota, abrir/promover/excluir/linkar por nome, ou perguntar
                algo sobre suas próprias notas.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-1.5",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>

          {phase === "confirm" && pendingConfirm && (
            <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
              <Button variant="outline" size="sm" onClick={() => resolveConfirm(false)}>
                Não
              </Button>
              <Button size="sm" onClick={() => resolveConfirm(true)}>
                <Check className="size-3.5" /> Sim
              </Button>
            </div>
          )}

          <form onSubmit={submitText} className="flex items-center gap-2 border-t p-2">
            <Input
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Escreva pra Nane..."
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" className="h-8" disabled={isThinking}>
              Enviar
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
