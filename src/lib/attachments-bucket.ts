/**
 * Nome do bucket de anexos no Supabase Storage — não é segredo (só um
 * identificador), por isso mora num arquivo próprio sem depender de env
 * var, importável tanto do servidor (src/lib/supabase-storage.ts) quanto
 * do cliente (attachments-panel.tsx, pra completar o upload no signed
 * URL emitido pelo servidor).
 */
export const ATTACHMENTS_BUCKET = "attachments";
