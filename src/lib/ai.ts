/**
 * Cliente mínimo pra Chat Completions da OpenAI, sem depender do SDK
 * oficial (evita mais uma dependência só pra um punhado de chamadas). Toda
 * feature de IA do app é best-effort: se a chave não estiver configurada,
 * ou a chamada falhar/der timeout, retorna null e quem chamou decide como
 * degradar (normalmente: não bloquear o usuário, só deixar de sugerir).
 */

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 12_000;
// Busca na web demora mais que uma chamada de texto normal — timeout maior,
// só usado por aiWebSearch.
const WEB_SEARCH_TIMEOUT_MS = 20_000;

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Pede uma resposta em JSON pro modelo, com timeout e parsing defensivos. */
export async function aiJSON<T>(systemPrompt: string, userPrompt: string): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;
    return JSON.parse(text) as T;
  } catch {
    // Timeout, rede fora, JSON malformado devolvido pelo modelo, etc. —
    // nenhum desses deve derrubar a requisição de quem chamou.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Pede um texto livre (não-JSON) pro modelo. Mesma política de falha silenciosa. */
export async function aiText(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pesquisa na web via a Responses API da OpenAI (ferramenta hospedada
 * "web_search") — mesma chave já configurada, sem cadastro em outro
 * serviço. Best-effort igual o resto deste arquivo: se o modelo/ferramenta
 * não estiver disponível na conta, ou der timeout, retorna null e quem
 * chamou segue sem o resultado da busca (nunca quebra a feature toda).
 */
export async function aiWebSearch(instructions: string, input: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEB_SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input,
        tools: [{ type: "web_search" }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (typeof data?.output_text === "string" && data.output_text.trim()) {
      return data.output_text.trim();
    }
    // Fallback pra quando a API não devolve o atalho output_text: procura
    // manualmente o item de mensagem dentro do array output.
    const output = Array.isArray(data?.output) ? data.output : [];
    for (const item of output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      const part = item.content.find((c: { type?: string; text?: string }) => c?.type === "output_text");
      if (typeof part?.text === "string" && part.text.trim()) return part.text.trim();
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
