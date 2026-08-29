"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { Mic, MicOff, Volume2, VolumeX, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { postJSON, patchJSON } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_TYPE_META } from "@/lib/note-types";
import { toast } from "sonner";

// Web Speech API não tem tipos oficiais no TS/DOM lib — declara só o que a
// gente usa. Suporte real: Chrome/Edge desktop e Android. Firefox e Safari
// (inclusive iOS, onde o app roda como PWA) não implementam — nesses casos
// a Nane cai pro campo de texto, nunca fica sem funcionar.
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const WAKE_WORD_RE = /\bnane\b/i;
const SILENCE_MS = 1600;

type Phase = "idle" | "wake" | "listening" | "thinking" | "confirm";
type ChatMessage = { role: "user" | "nane"; text: string };
type PendingPromote = { noteId: string; title: string; targetType: string };

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/**
 * Nane — assistente de voz do Khrov. Ícone discreto no cabeçalho (não um
 * botão flutuante sobre o conteúdo — incomodava e cobria ações no fim de
 * listas no mobile). Push-to-talk sempre disponível quando o navegador
 * suporta reconhecimento de fala; modo mãos-livres (wake word "Nane") é
 * opt-in via o próprio painel, nunca liga sozinho.
 */
export function NaneAssistant() {
  const router = useRouter();
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [open, setOpen] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [pendingPromote, setPendingPromote] = useState<PendingPromote | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stoppingRef = useRef(false);
  const pendingCommandRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const handsFreeRef = useRef(false);
  const pendingPromoteRef = useRef<PendingPromote | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);
  useEffect(() => {
    pendingPromoteRef.current = pendingPromote;
  }, [pendingPromote]);

  const say = useCallback(
    (text: string) => {
      setMessages((m) => [...m, { role: "nane", text }]);
      if (!muted) speak(text);
    },
    [muted]
  );

  const handleAction = useCallback(
    async (action: { type: string; noteId?: string; title?: string; targetType?: string } | null) => {
      if (!action) return;
      if (action.type === "note_created" || action.type === "open_note") {
        if (action.noteId) {
          await mutate("/api/notes");
          router.push(`/notes/${action.noteId}`);
        }
      } else if (action.type === "confirm_promote" && action.noteId && action.title && action.targetType) {
        setPendingPromote({ noteId: action.noteId, title: action.title, targetType: action.targetType });
        setPhase("confirm");
        return;
      }
      setPhase(handsFreeRef.current ? "wake" : "idle");
    },
    [router]
  );

  const runCommand = useCallback(
    async (transcript: string) => {
      const text = transcript.trim();
      if (!text) {
        setPhase(handsFreeRef.current ? "wake" : "idle");
        return;
      }
      setOpen(true);
      setMessages((m) => [...m, { role: "user", text }]);
      setPhase("thinking");
      try {
        const result = await postJSON<{ reply: string; action: { type: string; [k: string]: unknown } | null }>(
          "/api/nane/command",
          { transcript: text }
        );
        say(result.reply);
        await handleAction(result.action as never);
      } catch (err) {
        say(err instanceof Error ? err.message : "Deu um erro aqui, tenta de novo.");
        setPhase(handsFreeRef.current ? "wake" : "idle");
      }
    },
    [handleAction, say]
  );

  const resolveConfirm = useCallback(
    async (accepted: boolean) => {
      const pending = pendingPromoteRef.current;
      setPendingPromote(null);
      if (!pending) {
        setPhase(handsFreeRef.current ? "wake" : "idle");
        return;
      }
      if (!accepted) {
        say("Beleza, não mexi em nada.");
        setPhase(handsFreeRef.current ? "wake" : "idle");
        return;
      }
      setPhase("thinking");
      try {
        await patchJSON(`/api/notes/${pending.noteId}`, { type: pending.targetType });
        await mutate("/api/notes");
        const label = NOTE_TYPE_META[pending.targetType as keyof typeof NOTE_TYPE_META]?.label ?? pending.targetType;
        say(`Pronto — "${pending.title}" agora é ${label}.`);
      } catch (err) {
        // A trava de fricção do pipeline continua valendo mesmo por voz — se
        // o PATCH recusar, a Nane só repassa o motivo, não força nada.
        say(err instanceof Error ? err.message : "Não consegui promover essa nota agora.");
      } finally {
        setPhase(handsFreeRef.current ? "wake" : "idle");
      }
    },
    [say]
  );

  const finalizeListening = useCallback(() => {
    const text = pendingCommandRef.current;
    pendingCommandRef.current = "";
    runCommand(text);
  }, [runCommand]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(finalizeListening, SILENCE_MS);
  }, [finalizeListening]);

  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += `${r[0].transcript} `;
      }
      finalChunk = finalChunk.trim();
      if (!finalChunk) return;

      if (phaseRef.current === "confirm") {
        const n = finalChunk.toLowerCase();
        if (/\b(sim|confirmo|pode|isso)\b/.test(n)) resolveConfirm(true);
        else if (/\b(não|nao|cancela|deixa)\b/.test(n)) resolveConfirm(false);
        return;
      }

      if (phaseRef.current === "wake") {
        if (!WAKE_WORD_RE.test(finalChunk)) return;
        const afterWake = finalChunk.replace(WAKE_WORD_RE, "").trim();
        pendingCommandRef.current = afterWake;
        setPhase("listening");
        resetSilenceTimer();
        return;
      }

      if (phaseRef.current === "listening") {
        pendingCommandRef.current = `${pendingCommandRef.current} ${finalChunk}`.trim();
        resetSilenceTimer();
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Preciso de permissão de microfone pra funcionar.");
        setHandsFree(false);
        setPhase("idle");
      }
      // "no-speech" e outros erros transitórios: deixa o onend reiniciar.
    };

    recognition.onend = () => {
      if (stoppingRef.current) return;
      // Chrome encerra o reconhecimento periodicamente mesmo em modo
      // contínuo — reinicia sozinho enquanto mãos-livres ou uma escuta
      // ativa (push-to-talk) ainda fizer sentido.
      if (handsFreeRef.current || phaseRef.current === "listening") {
        try {
          recognition.start();
        } catch {
          // já estava rodando — ignora
        }
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [resetSilenceTimer, resolveConfirm]);

  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      recognitionRef.current?.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function toggleHandsFree() {
    if (!supported) return;
    if (handsFree) {
      setHandsFree(false);
      stoppingRef.current = true;
      recognitionRef.current?.stop();
      setPhase("idle");
      return;
    }
    const recognition = ensureRecognition();
    if (!recognition) return;
    stoppingRef.current = false;
    setHandsFree(true);
    setPhase("wake");
    setOpen(true);
    try {
      recognition.start();
    } catch {
      // já rodando
    }
  }

  function pushToTalk() {
    if (!supported) return;
    setOpen(true);
    const recognition = ensureRecognition();
    if (!recognition) return;
    pendingCommandRef.current = "";
    stoppingRef.current = false;
    setPhase("listening");
    if (!handsFree) {
      try {
        recognition.start();
      } catch {
        // já rodando (mãos-livres ligado) — tudo bem, só mudou a fase
      }
    }
  }

  function submitText(e: React.FormEvent) {
    e.preventDefault();
    const text = textInput.trim();
    if (!text) return;
    setTextInput("");
    runCommand(text);
  }

  const listening = phase === "listening";
  const isThinking = phase === "thinking";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => (open ? setOpen(false) : supported ? pushToTalk() : setOpen(true))}
        title={supported ? "Falar com a Nane" : "Conversar com a Nane"}
        className={cn("size-8", listening && "animate-pulse text-primary")}
      >
        <Mic className="size-4" />
      </Button>

      {open && (
        <div className="fixed top-16 right-4 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Nane</span>
              {isThinking && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              {listening && <span className="text-xs text-primary">ouvindo...</span>}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                title={muted ? "Ativar voz" : "Silenciar voz"}
                onClick={() => setMuted((v) => !v)}
              >
                {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && (
              <p className="text-muted-foreground">
                {supported
                  ? 'Aperte o microfone e fale, ou ligue o modo mãos-livres pra chamar por "Nane".'
                  : "Seu navegador não tem reconhecimento de fala — digite o que quiser pedir."}
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

          {phase === "confirm" && pendingPromote && (
            <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
              <Button variant="outline" size="sm" onClick={() => resolveConfirm(false)}>
                Não
              </Button>
              <Button size="sm" onClick={() => resolveConfirm(true)}>
                <Check className="size-3.5" /> Sim
              </Button>
            </div>
          )}

          <div className="border-t p-2">
            {supported ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={handsFree ? "default" : "outline"}
                  size="sm"
                  className="h-8 flex-1 gap-1.5 text-xs"
                  onClick={toggleHandsFree}
                >
                  {handsFree ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
                  {handsFree ? "Mãos-livres ligado" : 'Ativar "Nane" mãos-livres'}
                </Button>
                <Button type="button" size="sm" className="h-8" onClick={pushToTalk} disabled={listening || isThinking}>
                  <Mic className="size-3.5" />
                </Button>
              </div>
            ) : (
              <form onSubmit={submitText} className="flex items-center gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Fale com a Nane..."
                  className="h-8 text-sm"
                />
                <Button type="submit" size="sm" className="h-8" disabled={isThinking}>
                  Enviar
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
