import { createClient } from "@supabase/supabase-js";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments-bucket";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export { ATTACHMENTS_BUCKET };
export const isSupabaseStorageConfigured = Boolean(url && serviceRoleKey);

/**
 * Cliente admin (service role) — SÓ no servidor, nunca enviado pro
 * browser. Bypassa RLS de propósito: quem decide o que cada usuário pode
 * ver/mexer continua sendo a própria rota de API (confere
 * note.userId === userId antes de emitir qualquer signed URL), exatamente
 * como funcionava com as credenciais secretas do Cloudflare R2 antes
 * dessa troca.
 */
export const supabaseStorage = isSupabaseStorageConfigured
  ? createClient(url!, serviceRoleKey!, { auth: { persistSession: false } })
  : null;
