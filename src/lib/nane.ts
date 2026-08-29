/**
 * Nane — a assistente de voz do Khrov. Recebe uma transcrição (com
 * possíveis erros de reconhecimento de fala) e decide o que fazer: ditar
 * uma nota nova, abrir uma nota, pedir pra promover uma nota (sempre com
 * confirmação — quem de fato aplica a mudança de estágio continua sendo
 * o PATCH /api/notes/[id], com todas as travas de fricção intactas), ou
 * responder uma pergunta puxando conteúdo das notas do usuário.
 */
import { aiJSON, aiText, aiWebSearch, aiEnabled } from "@/lib/ai";
import { NOTE_TYPES, NOTE_TYPE_META, nextNoteType, isNoteType, type NoteTypeValue } from "@/lib/note-types";

export type NaneIntent =
  | "create_note"
  | "open_note"
  | "promote_note"
  | "note_feedback"
  | "delete_note"
  | "link_notes"
  | "answer_question"
  | "unknown";

export type NaneNoteRef = { id: string; title: string; type: NoteTypeValue };

type RawIntent = {
  intent: NaneIntent;
  reply: string;
  noteQuery?: string;
  targetStage?: string;
  noteContent?: string;
  /** Só pra link_notes: a segunda nota, a que a primeira vai linkar. */
  targetNoteQuery?: string;
};

/** "essa nota"/"nota atual"/vazio (com contexto) — usuário quer dizer a nota que está aberta agora. */
function wantsCurrentNote(query: string | undefined): boolean {
  if (!query) return true;
  const n = normalize(query);
  return /\b(essa|esta|atual|aqui)\b/.test(n) && !/\b(sobre|chamada)\b/.test(n);
}

/** Resolve qual nota o comando quer dizer: por nome, ou a nota atualmente aberta (contexto). */
function resolveTargetNote(
  noteQuery: string | undefined,
  transcript: string,
  notes: NaneNoteRef[],
  contextNoteId: string | null
): NaneNoteRef | null {
  if (wantsCurrentNote(noteQuery) && contextNoteId) {
    const current = notes.find((n) => n.id === contextNoteId);
    if (current) return current;
  }
  const query = noteQuery || transcript;
  return matchNote(query, notes);
}

const STAGE_WORDS: Record<string, NoteTypeValue> = {
  "estímulo": "STIMULUS",
  estimulo: "STIMULUS",
  "potenciação": "POTENTIATION",
  potenciacao: "POTENTIATION",
  sinapse: "SYNAPSE",
  engrama: "ENGRAM",
};

// Faixa Unicode das marcas diacríticas combinantes — remove acentos depois do normalize("NFD").
const DIACRITICS_RE = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "").trim();
}

/** Casa a fala (ex: "a nota sobre zettelkasten") com o título mais parecido dentre as notas do usuário. */
export function matchNote(query: string, notes: NaneNoteRef[]): NaneNoteRef | null {
  const q = normalize(query);
  if (!q) return null;

  let best: NaneNoteRef | null = null;
  let bestScore = 0;
  for (const note of notes) {
    const t = normalize(note.title);
    if (!t) continue;
    let score = 0;
    if (t === q) score = 100;
    else if (t.includes(q) || q.includes(t)) score = Math.min(t.length, q.length);
    if (score > bestScore) {
      bestScore = score;
      best = note;
    }
  }
  return bestScore >= 3 ? best : null;
}

function guessStage(text: string, fallback: NoteTypeValue | null): NoteTypeValue | null {
  const n = normalize(text);
  for (const [word, stage] of Object.entries(STAGE_WORDS)) {
    if (n.includes(word)) return stage;
  }
  return fallback;
}

/** Classificador de regra simples — usado quando a IA não responde (sem chave, timeout etc.), pra Nane nunca ficar muda. */
function ruleBasedIntent(transcript: string): RawIntent {
  const n = normalize(transcript);

  if (/^abr[ea]\b/.test(n) || /^(vai pra|ir pra)\b/.test(n)) {
    const noteQuery = transcript.replace(/^\s*\S+\s*/, "").trim();
    return { intent: "open_note", reply: `Procurando "${noteQuery}"...`, noteQuery };
  }

  if (/^promov[ae]\b/.test(n)) {
    return {
      intent: "promote_note",
      reply: "Deixa eu ver essa nota...",
      noteQuery: transcript.replace(/^\s*\S+\s*/, "").trim(),
    };
  }

  if (/^(apaga|apague|exclu[ai]|deleta)\b/.test(n)) {
    return {
      intent: "delete_note",
      reply: "Deixa eu achar essa nota...",
      noteQuery: transcript.replace(/^\s*\S+\s*/, "").trim(),
    };
  }

  if (/^(linka|link|conecta|relaciona)\b/.test(n) && / com /.test(n)) {
    const rest = transcript.replace(/^\s*\S+\s*/, "");
    const [first, second] = rest.split(/\bcom\b/i);
    return {
      intent: "link_notes",
      reply: "Deixa eu achar as duas notas...",
      noteQuery: (first ?? "").trim(),
      targetNoteQuery: (second ?? "").trim(),
    };
  }

  if (/\b(melhorar?|sugest[aã]o|sugest[oõ]es|dica[s]?)\b/.test(n)) {
    return {
      intent: "note_feedback",
      reply: "Deixa eu olhar essa nota...",
      noteQuery: transcript.replace(/\b(melhorar?|sugest[aã]o|sugest[oõ]es|dica[s]?)\b/g, "").trim(),
    };
  }

  if (/^(o que|como|por que|porque|quando|quem|qual|quais)\b/.test(n) || n.endsWith("?")) {
    return {
      intent: "answer_question",
      reply: "Não consegui pensar numa resposta agora — tenta de novo daqui a pouco.",
    };
  }

  return { intent: "create_note", reply: "Estímulo criado.", noteContent: transcript };
}

async function classifyIntent(transcript: string, notes: NaneNoteRef[]): Promise<RawIntent> {
  if (!aiEnabled()) return ruleBasedIntent(transcript);

  const noteList = notes.slice(0, 200).map((n) => `- ${n.title}`).join("\n") || "(nenhuma nota ainda)";

  const result = await aiJSON<RawIntent>(
    "Você é Nane, a assistente de voz de dentro de um app de gestão de conhecimento pessoal chamado " +
      "Khrov. As notas passam por um pipeline: Estímulo (captura crua) → Potenciação (cruza " +
      "referências e aprofunda) → Sinapse (síntese consolidada) → Engrama (validado por flashcards). " +
      "Você recebe um comando de voz TRANSCRITO (pode ter erros de reconhecimento de fala — corrija " +
      "mentalmente erros óbvios) e decide a intenção. Responda só em JSON com este formato: " +
      '{"intent": "create_note"|"open_note"|"promote_note"|"note_feedback"|"delete_note"|"link_notes"|' +
      '"answer_question"|"unknown", ' +
      '"reply": string curta em português, no tom falado de uma assistente de voz, ' +
      '"noteQuery": string opcional (título ou parte do título da nota — pra link_notes, é a PRIMEIRA ' +
      'nota; deixe vazio ou diga "essa nota"/"nota atual" se o usuário se referir à nota que está aberta ' +
      "na tela agora — não peça pra especificar, some pra open_note/promote_note/note_feedback/" +
      "delete_note/link_notes), " +
      '"targetStage": string opcional (Estímulo/Potenciação/Sinapse/Engrama, só pra promote_note), ' +
      '"targetNoteQuery": string opcional (só pra link_notes: a SEGUNDA nota, a que a primeira vai ' +
      "linkar), " +
      '"noteContent": string opcional (só pra create_note: o texto que vira o corpo da nota, limpo, ' +
      "sem frases tipo 'Nane, anota que...' no começo)}. " +
      "Se o comando for uma pergunta sobre o que o usuário já sabe/escreveu, é answer_question. Se for " +
      "só falar algo pra guardar, é create_note. Se pedir pra abrir/ir pra uma nota, é open_note. Se " +
      "pedir pra promover/mover uma nota de estágio, é promote_note. Se pedir sugestão, dica ou como " +
      "melhorar uma nota (a atual ou uma nomeada), é note_feedback. Se pedir pra apagar/excluir uma " +
      "nota, é delete_note (SEMPRE peça confirmação antes — nunca finja que já apagou). Se pedir pra " +
      "linkar/conectar/relacionar uma nota com outra, é link_notes.",
    `Notas existentes do usuário:\n${noteList}\n\nComando transcrito: "${transcript}"`
  );

  return result ?? ruleBasedIntent(transcript);
}

const STOPWORDS = new Set(
  "de da do das dos em no na nos nas um uma uns umas e ou que qual quais como por para pra com sem sobre isso essa esse esses essas aquele aquela the a o os as".split(
    " "
  )
);

function extractSearchTerms(question: string): string[] {
  return Array.from(
    new Set(
      normalize(question)
        .split(/[^a-z0-9à-ú]+/i)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    )
  );
}

export type NaneAnswerContext = { search: (terms: string[]) => Promise<{ title: string; plainText: string }[]> };

async function answerQuestion(question: string, ctx: NaneAnswerContext): Promise<string> {
  const terms = extractSearchTerms(question);
  const hits = terms.length ? await ctx.search(terms) : [];

  if (hits.length === 0) {
    return "Não achei nada nas suas notas sobre isso.";
  }

  const context = hits
    .slice(0, 5)
    .map((n) => `- ${n.title}: ${n.plainText.slice(0, 600)}`)
    .join("\n");

  const answer = await aiText(
    "Você é Nane, a assistente de voz de um app de gestão de conhecimento pessoal. Responda a pergunta " +
      "do usuário SÓ com base nos trechos de notas fornecidos, num tom falado, curto e direto (é lido em " +
      "voz alta). Se os trechos não derem pra responder direito, diga isso claramente. Cite o título da " +
      "nota de onde tirou a resposta quando fizer sentido.",
    `Trechos das notas:\n${context}\n\nPergunta: "${question}"`
  );

  return answer ?? `Achei algo em "${hits[0].title}", mas não consegui formular uma resposta agora.`;
}

/**
 * Uma dica qualitativa de conteúdo pra nota (além do que falta pra ela
 * avançar de estágio, que é calculado à parte, de forma determinística,
 * em api/nane/command). Não pode ser um resumo do que a nota já diz.
 */
export async function suggestNoteImprovement(
  title: string,
  plainText: string,
  linkedTitles: string[]
): Promise<string | null> {
  if (!plainText.trim()) return null;

  const [contentTip, webInfo] = await Promise.all([
    aiText(
      "Você é Nane, assistente de um app de gestão de conhecimento pessoal. Dê UMA sugestão curta (1 " +
        "frase, direta) de como o CONTEÚDO dessa nota poderia ficar melhor — aprofundar um ponto vago, " +
        "dar um exemplo concreto, considerar uma nota relacionada pra linkar, etc. Não repita nem resuma " +
        "o que a nota já diz, e não fale sobre estágios do pipeline (isso é dito à parte). Se o conteúdo " +
        "já estiver denso e bem desenvolvido, diga isso brevemente em vez de forçar uma crítica.",
      `Nota:\n"""${plainText.slice(0, 1500)}"""\n\nNotas já linkadas por ela: ${linkedTitles.join(", ") || "nenhuma"}`
    ),
    aiWebSearch(
      "Você busca informação factual e atualizada na web relevante ao assunto de uma nota de conhecimento " +
        "pessoal. Devolva no máximo 2 frases só com INFORMAÇÃO — fatos, dados, definições, desenvolvimentos " +
        "recentes — que ajudem a enriquecer a nota. NUNCA escreva argumentação, conclusão, opinião ou uma " +
        "tese pronta: isso é trabalho de quem escreve a nota, você só entrega insumo bruto pra pesquisa. Se " +
        "não achar nada específico e relevante o bastante, diga isso em vez de forçar algo genérico.",
      `Nota intitulada "${title}":\n"""${plainText.slice(0, 800)}"""`
    ),
  ]);

  if (!contentTip && !webInfo) return null;
  return [contentTip, webInfo ? `Pesquisando na web: ${webInfo}` : null].filter(Boolean).join(" ");
}

export type NaneResult =
  | { intent: "create_note"; reply: string; noteContent: string }
  | { intent: "open_note"; reply: string; note: NaneNoteRef | null }
  | { intent: "promote_note"; reply: string; note: NaneNoteRef | null; targetType: NoteTypeValue | null }
  | { intent: "note_feedback"; note: NaneNoteRef | null }
  | { intent: "delete_note"; note: NaneNoteRef | null }
  | { intent: "link_notes"; source: NaneNoteRef | null; target: NaneNoteRef | null }
  | { intent: "answer_question"; reply: string }
  | { intent: "unknown"; reply: string };

export async function resolveNaneCommand(
  transcript: string,
  notes: NaneNoteRef[],
  answerCtx: NaneAnswerContext,
  contextNoteId: string | null = null
): Promise<NaneResult> {
  const raw = await classifyIntent(transcript, notes);

  if (raw.intent === "create_note") {
    return { intent: "create_note", reply: raw.reply, noteContent: raw.noteContent?.trim() || transcript };
  }

  if (raw.intent === "open_note") {
    const note = raw.noteQuery ? matchNote(raw.noteQuery, notes) : null;
    return {
      intent: "open_note",
      reply: note ? `Abrindo "${note.title}".` : "Não achei nenhuma nota com esse nome.",
      note,
    };
  }

  if (raw.intent === "note_feedback") {
    const note = resolveTargetNote(raw.noteQuery, transcript, notes, contextNoteId);
    return { intent: "note_feedback", note };
  }

  if (raw.intent === "promote_note") {
    const note = resolveTargetNote(raw.noteQuery, transcript, notes, contextNoteId);
    if (!note) {
      return { intent: "promote_note", reply: "Não achei nenhuma nota com esse nome.", note: null, targetType: null };
    }
    const stageFromWords = raw.targetStage ? guessStage(raw.targetStage, null) : guessStage(transcript, null);
    const targetType = stageFromWords ?? nextNoteType(note.type);
    const pipelineTypes: readonly string[] = NOTE_TYPES;
    if (!targetType || !isNoteType(targetType) || pipelineTypes.indexOf(targetType) <= pipelineTypes.indexOf(note.type)) {
      return {
        intent: "promote_note",
        reply: `"${note.title}" já está em ${NOTE_TYPE_META[note.type].label} ou além — não tem próximo estágio pra sugerir.`,
        note,
        targetType: null,
      };
    }
    return {
      intent: "promote_note",
      reply: `Quer que eu promova "${note.title}" pra ${NOTE_TYPE_META[targetType].label}?`,
      note,
      targetType,
    };
  }

  if (raw.intent === "delete_note") {
    const note = resolveTargetNote(raw.noteQuery, transcript, notes, contextNoteId);
    return { intent: "delete_note", note };
  }

  if (raw.intent === "link_notes") {
    const source = resolveTargetNote(raw.noteQuery, transcript, notes, contextNoteId);
    const target = raw.targetNoteQuery ? matchNote(raw.targetNoteQuery, notes) : null;
    return { intent: "link_notes", source, target };
  }

  if (raw.intent === "answer_question") {
    const reply = await answerQuestion(transcript, answerCtx);
    return { intent: "answer_question", reply };
  }

  return { intent: "unknown", reply: raw.reply || "Não entendi — pode repetir?" };
}
