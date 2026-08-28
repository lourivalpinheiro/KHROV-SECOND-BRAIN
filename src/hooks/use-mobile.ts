import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Começa como `undefined` (equivalente a `false`) tanto no servidor quanto na
  // primeira renderização do cliente, para casar com o HTML do SSR e evitar
  // erro de hidratação; o valor real só é aplicado depois do mount.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor real do client só existe após o mount; necessário para não quebrar a hidratação
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
