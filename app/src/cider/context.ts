/**
 * Contexto do player do Cider.
 *
 * Separado do provider e do hook porque os três precisam ficar em arquivos
 * distintos: um módulo que exporta componente **e** função quebra o Fast Refresh
 * do Vite, e recarregar a página derrubaria a reprodução.
 */

import { createContext } from "react";
import type { CiderEngine, PlayerSnapshot } from "./engine";

export interface CiderContextValue {
  state: PlayerSnapshot;
  engine: CiderEngine;
}

export const CiderContext = createContext<CiderContextValue | null>(null);
