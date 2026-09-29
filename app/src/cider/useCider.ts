/**
 * Lê o estado do player do Cider.
 *
 * Módulo separado do `provider.tsx` porque um arquivo que exporta componente e
 * hook quebra o Fast Refresh do Vite — mexer em qualquer detalhe do Cider
 * recarregaria a página e derrubaria a reprodução.
 */
import { useContext } from "react";
import { CiderContext, type CiderContextValue } from "./context";

export function useCider(): CiderContextValue {
  const context = useContext(CiderContext);
  if (!context) throw new Error("useCider precisa estar dentro de CiderProvider");
  return context;
}
