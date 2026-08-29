/**
 * Features de IA sobre o conteúdo das notas. Cada função aqui é best-effort
 * (ver src/lib/ai.ts): se a IA não responder, quem chamou trata como "sem
 * opinião" e nunca bloqueia o usuário por causa disso — só o filtro
 * determinístico correspondente (quando existe) é obrigatório.
 */
import { aiEnabled, aiJSON, aiText } from "@/lib/ai";

export { aiEnabled };

const MAX_CHARS = 1800;
const clip = (text: string) => text.slice(0, MAX_CHARS);

export type SemanticRelevance = { related: boolean; reason?: string };

/**
 * Regra do Contexto Semântico: a nota linkada tem alguma relação de
 * sentido com a nota atual, além de só "ter conteúdo" (filtro anti-lixo
 * determinístico, que já roda antes disso em outro lugar)?
 */
export async function checkSemanticRelevance(
  sourceText: string,
  targetText: string
): Promise<SemanticRelevance | null> {
  return aiJSON<SemanticRelevance>(
    "Você avalia se duas notas de um segundo cérebro têm relação de sentido mínima entre si. " +
      'Responda só em JSON: {"related": boolean, "reason": string curta em português}. ' +
      "Seja permissivo: relações indiretas, temáticas ou conceituais contam como relacionadas. " +
      "Só responda related:false quando os dois textos forem claramente sobre assuntos sem nenhuma conexão " +
      "(ex: uma é sobre uma receita de bolo e a outra sobre física de partículas).",
    `Nota atual (Estímulo):\n"""${clip(sourceText)}"""\n\nNota linkada:\n"""${clip(targetText)}"""\n\n` +
      "Elas têm alguma relação de conteúdo ou tema?"
  );
}

/**
 * Rascunho de síntese pra Potenciação→Sinapse: um ponto de partida que o
 * usuário AINDA PRECISA reescrever com as próprias palavras — a trava
 * determinística de "não pode ser cópia" continua rodando no servidor
 * contra o texto final que o usuário de fato submeter.
 */
export async function suggestSynthesis(
  currentText: string,
  linkedNotes: { title: string; plainText: string }[]
): Promise<string | null> {
  const context = linkedNotes
    .filter((n) => n.plainText.trim())
    .slice(0, 5)
    .map((n) => `- ${n.title}: ${clip(n.plainText)}`)
    .join("\n");

  return aiText(
    "Você ajuda alguém a escrever, em português do Brasil, a síntese de uma nota num sistema de " +
      "gestão de conhecimento pessoal (pipeline Estímulo → Potenciação → Sinapse → Engrama). " +
      "A síntese é a 'premissa fundamental' que a pessoa domina sobre o assunto, cruzando a nota " +
      "atual com as notas que ela linkou. Escreva um rascunho CURTO (3 a 5 frases), num tom direto, " +
      "de quem já entendeu o assunto — não um resumo genérico. Isso é só um ponto de partida: a " +
      "pessoa vai editar antes de aceitar, então não precisa ser perfeito nem soar definitivo.",
    `Nota atual:\n"""${clip(currentText)}"""\n\nNotas linkadas:\n${context || "(nenhuma com conteúdo ainda)"}\n\n` +
      "Escreva o rascunho da síntese."
  );
}

export type ContradictionResult = { noteId: string; title: string; reason: string };

/**
 * Pra notas já maduras (Sinapse/Engrama): compara a síntese desta nota com
 * a de cada nota linkada que também já tem síntese, e a IA aponta pares
 * que parecem se contradizer. Sob demanda (botão), não roda sozinho.
 */
export async function checkContradiction(
  sourceSynthesis: string,
  targetTitle: string,
  targetSynthesis: string
): Promise<{ contradicts: boolean; reason?: string } | null> {
  return aiJSON<{ contradicts: boolean; reason?: string }>(
    "Você compara duas afirmações de conhecimento (sínteses) de um segundo cérebro pessoal e diz se " +
      "elas se contradizem de forma direta — não apenas se são sobre temas diferentes ou têm ênfases " +
      'diferentes. Responda só em JSON: {"contradicts": boolean, "reason": string curta em português, ' +
      'explicando a contradição se houver}. Seja conservador: só marque contradicts:true se as duas ' +
      "afirmações não puderem ser ambas verdadeiras ao mesmo tempo.",
    `Síntese A (nota atual):\n"""${clip(sourceSynthesis)}"""\n\nSíntese B (nota "${targetTitle}"):\n"""${clip(
      targetSynthesis
    )}"""\n\nElas se contradizem?`
  );
}
