import { Activity, BrainCircuit, Sparkles, Wallet, type LucideIcon } from "lucide-react";

export type ModuleKey = "espiritual" | "saude" | "notas" | "financeiro";

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Classe de tema (ver globals.css) — undefined = azul padrão (Conhecimento não precisa de override). */
  themeClass?: string;
  comingSoon?: boolean;
};

/**
 * Config central dos módulos do Khrov — usada pelo trocador da sidebar,
 * pelo Cmd+K e por qualquer lugar que precise saber "quais módulos
 * existem, em que ordem, com que ícone/cor". Ordem é a ordem de exibição
 * pedida: Espiritual, Saúde, Conhecimento, Financeiro.
 */
export const MODULES: ModuleDef[] = [
  { key: "espiritual", label: "Espiritual", icon: Sparkles, href: "/espiritual", themeClass: "theme-espiritual", comingSoon: true },
  { key: "saude", label: "Saúde", icon: Activity, href: "/saude", themeClass: "theme-saude" },
  { key: "notas", label: "Conhecimento", icon: BrainCircuit, href: "/notes" },
  { key: "financeiro", label: "Financeiro", icon: Wallet, href: "/financeiro", themeClass: "theme-financeiro" },
];

/** Deriva o módulo ativo a partir do caminho — um link direto ou F5 sempre abre no módulo certo. */
export function moduleFromPathname(pathname: string): ModuleKey {
  if (pathname.startsWith("/saude")) return "saude";
  if (pathname.startsWith("/financeiro")) return "financeiro";
  if (pathname.startsWith("/espiritual")) return "espiritual";
  return "notas";
}

export function moduleDef(key: ModuleKey): ModuleDef {
  return MODULES.find((m) => m.key === key)!;
}
