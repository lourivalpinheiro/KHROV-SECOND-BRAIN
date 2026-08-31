// Aplica o tema vermelho (ver .theme-saude em globals.css) em todo o
// módulo Saúde, num lugar só — "contents" pra não interferir no layout
// flex das páginas (flex-1/overflow-y-auto etc.), só empresta o escopo
// de CSS.
export default function SaudeLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-saude contents">{children}</div>;
}
