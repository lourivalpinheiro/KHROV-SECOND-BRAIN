// Aplica o tema roxo (ver .theme-espiritual em globals.css) em todo o
// módulo Espiritual — mesmo esquema dos outros módulos, "contents" pra
// não interferir no layout flex das páginas.
export default function EspiritualLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-espiritual contents">{children}</div>;
}
