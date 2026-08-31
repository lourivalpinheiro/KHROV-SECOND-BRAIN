export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return res.json();
}

type RequestOpts = {
  /**
   * Sobrevive ao fechamento da aba/navegação — um fetch normal disparado
   * dentro de um handler de pagehide/beforeunload NÃO tem garantia de
   * terminar antes do navegador destruir a página (é só "melhor esforço").
   * keepalive:true delega o request pro navegador de forma assíncrona,
   * desacoplada do ciclo de vida da página — mas tem limite de tamanho
   * (~64KB), então só usa isso quando a página está de fato saindo, não
   * como padrão geral.
   */
  keepalive?: boolean;
};

async function request<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
  opts?: RequestOpts
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    keepalive: opts?.keepalive,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const postJSON = <T = unknown>(url: string, body?: unknown) => request<T>(url, "POST", body);
export const patchJSON = <T = unknown>(url: string, body?: unknown, opts?: RequestOpts) =>
  request<T>(url, "PATCH", body, opts);
export const deleteJSON = <T = unknown>(url: string) => request<T>(url, "DELETE");
