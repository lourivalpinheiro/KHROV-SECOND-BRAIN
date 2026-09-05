import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* — seguro de expor no bundle do cliente (chave anon/
// publishable, protegida por RLS/token, mesmo modelo da publishable key
// do Stripe). Usado só pra completar o upload num signed URL já emitido
// pelo servidor (ver /api/attachments/upload-url) — nunca acessa nada
// sem esse token.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseBrowserConfigured = Boolean(url && anonKey);

export const supabaseBrowser = isSupabaseBrowserConfigured ? createClient(url!, anonKey!) : null;
