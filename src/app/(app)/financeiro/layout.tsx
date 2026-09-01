// Aplica o tema dourado (ver .theme-financeiro em globals.css) em todo o
// módulo Financeiro, num lugar só — "contents" pra não interferir no
// layout flex das páginas, só empresta o escopo de CSS.
export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-financeiro contents">{children}</div>;
}
