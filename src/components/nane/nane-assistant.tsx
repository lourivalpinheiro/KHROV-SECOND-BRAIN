"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string; confidence?: number } };
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
// Enquanto captura um comando de verdade (fase "listening"), o reconhecimento
// reinicia sozinho se o motor encerrar no meio da fala. Um respiro curto
// evita reiniciar instantaneamente (menos bipe em sequência).
const RESTART_DELAY_MS = 500;
// Resultado com confiança abaixo disso é tratado como ruído, não comando —
// quando o navegador reporta confidence (nem todos reportam de forma útil).
const MIN_CONFIDENCE = 0.3;
// --- Detecção de volume (VAD) por energia do áudio cru, via Web Audio API ---
// O problema do modo mãos-livres "cru" (reconhecimento contínuo sempre
// rodando) é que o motor do Android/Chrome reage a QUALQUER som, não só
// voz, e reinicia sozinho sem parar. Em vez de deixar o reconhecimento
// sempre ligado, aqui é ele mesmo (via este medidor de volume local, sem
// mandar nada pra rede) que decide QUANDO vale a pena ligar o
// reconhecimento de verdade: só quando o som cruza um limiar de volume, e
// desliga de novo depois de um tempo em silêncio sem detectar a palavra-
// chave. Não é um detector de voz de verdade (não distingue "alguém
// falando perto" de "TV ligada alto") — só reduz reagir a ruído de fundo
// constante (ventilador, trânsito ao longe, etc.), que fica abaixo do
// limiar na maioria dos ambientes.
const VAD_INTERVAL_MS = 150;
const VAD_THRESHOLD = 20;
const VAD_QUIET_STOP_MS = 3000;

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
  const pathname = usePathname();
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [open, setOpen] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [pendingPromote, setPendingPromote] = useState<PendingPromote | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionActiveRef = useRef(false);
  const stoppingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommandRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const handsFreeRef = useRef(false);
  const pendingPromoteRef = useRef<PendingPromote | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoudAtRef = useRef(0);

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
      // Toda resposta sem side-effect de navegação (pergunta respondida,
      // sugestão de nota, intenção não reconhecida) chega com action: null
      // — precisa cair no reset de fase lá embaixo do mesmo jeito, senão
      // fica travada em "thinking" pra sempre (bug: esse early return
      // pulava o reset).
      if (action?.type === "note_created" || action?.type === "open_note") {
        if (action.noteId) {
          await mutate("/api/notes");
          router.push(`/notes/${action.noteId}`);
        }
      } else if (action?.type === "confirm_promote" && action.noteId && action.title && action.targetType) {
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
        // Se o usuário está numa nota agora, "essa nota"/"nota atual" na
        // fala se refere a ela — sem isso, a Nane não tem como saber qual.
        const contextNoteId = pathname?.match(/^\/notes\/([^/]+)/)?.[1] ?? null;
        const result = await postJSON<{ reply: string; action: { type: string; [k: string]: unknown } | null }>(
          "/api/nane/command",
          { transcript: text, contextNoteId }
        );
        say(result.reply);
        await handleAction(result.action as never);
      } catch (err) {
        say(err instanceof Error ? err.message : "Deu um erro aqui, tenta de novo.");
        setPhase(handsFreeRef.current ? "wake" : "idle");
      }
    },
    [handleAction, say, pathname]
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
        if (!r.isFinal) continue;
        // Ruído de fundo às vezes vira uma "transcrição" de baixa confiança
        // em vez de não gerar nada — descarta antes de tratar como fala.
        const confidence = r[0].confidence;
        if (typeof confidence === "number" && confidence > 0 && confidence < MIN_CONFIDENCE) continue;
        finalChunk += `${r[0].transcript} `;
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
      recognitionActiveRef.current = false;
      if (stoppingRef.current) return;
      // Enquanto captura um comando ou espera a confirmação de sim/não,
      // reinicia pra sobreviver a uma pausa curta no meio da fala — igual
      // antes. Na fase "wake" (só esperando a palavra-chave), NÃO reinicia
      // sozinho mais: quem decide religar o reconhecimento agora é o
      // medidor de volume (VAD) abaixo, só quando detectar som alto de
      // novo — senão volta a reagir a qualquer ruído de fundo o tempo todo.
      if (phaseRef.current === "listening" || phaseRef.current === "confirm") {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (stoppingRef.current) return;
          try {
            recognition.start();
            recognitionActiveRef.current = true;
          } catch {
            // já estava rodando — ignora
          }
        }, RESTART_DELAY_MS);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [resetSilenceTimer, resolveConfirm]);

  const stopVad = useCallback(() => {
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    vadIntervalRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  const startVad = useCallback(async () => {
    if (audioCtxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtxCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxCtor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      lastLoudAtRef.current = Date.now();

      vadIntervalRef.current = setInterval(() => {
        const an = analyserRef.current;
        if (!an) return;
        an.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] - 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / data.length);

        if (rms > VAD_THRESHOLD) {
          lastLoudAtRef.current = Date.now();
          if (phaseRef.current === "wake" && !recognitionActiveRef.current) {
            const recognition = ensureRecognition();
            if (recognition) {
              try {
                recognition.start();
                recognitionActiveRef.current = true;
              } catch {
                // já rodando
              }
            }
          }
        } else if (
          phaseRef.current === "wake" &&
          recognitionActiveRef.current &&
          Date.now() - lastLoudAtRef.current > VAD_QUIET_STOP_MS
        ) {
          // Um tempo em silêncio sem achar a palavra-chave — desliga o
          // reconhecimento de vez em vez de deixar rodando à toa até o
          // motor decidir encerrar sozinho.
          recognitionActiveRef.current = false;
          try {
            recognitionRef.current?.stop();
          } catch {
            // já parado
          }
        }
      }, VAD_INTERVAL_MS);
    } catch {
      toast.error("Preciso de permissão de microfone pra funcionar.");
      setHandsFree(false);
      setPhase("idle");
    }
  }, [ensureRecognition]);

  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      recognitionRef.current?.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      stopVad();
      window.speechSynthesis?.cancel();
    };
  }, [stopVad]);

  function toggleHandsFree() {
    if (!supported) return;
    if (handsFree) {
      setHandsFree(false);
      stoppingRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop();
      stopVad();
      setPhase("idle");
      return;
    }
    if (!ensureRecognition()) return;
    stoppingRef.current = false;
    setHandsFree(true);
    setPhase("wake");
    setOpen(true);
    // Não liga o reconhecimento aqui — fica esperando o medidor de volume
    // (VAD) detectar som alto o bastante pra valer a pena tentar ouvir a
    // palavra-chave. É essa troca que evita reagir a qualquer ruído.
    startVad();
  }

  function pushToTalk() {
    if (!supported) return;
    setOpen(true);
    const recognition = ensureRecognition();
    if (!recognition) return;
    pendingCommandRef.current = "";
    stoppingRef.current = false;
    setPhase("listening");
    // Com o VAD, o reconhecimento pode estar parado mesmo com mãos-livres
    // ligado (esperando som alto) — checa se já está rodando de verdade,
    // não só se o modo mãos-livres está ativo.
    if (!recognitionActiveRef.current) {
      try {
        recognition.start();
        recognitionActiveRef.current = true;
      } catch {
        // já rodando
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
                  ? 'Aperte o microfone e fale, ligue o modo mãos-livres pra chamar por "Nane", ou escreva ali embaixo.'
                  : "Seu navegador não tem reconhecimento de fala — escreva ali embaixo."}
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

          <div className="space-y-2 border-t p-2">
            {supported && (
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
            )}
            <form onSubmit={submitText} className="flex items-center gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ou escreva pra Nane..."
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" className="h-8" disabled={isThinking}>
                Enviar
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
