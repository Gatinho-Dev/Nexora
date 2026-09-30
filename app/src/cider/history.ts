/**
 * Histórico de navegação interno do Cider.
 *
 * O desktop tinha pilha própria de rotas (`state/ui.ts`) porque era uma janela
 * única. Aqui a navegação é do `react-router`, e o navegador já guarda o
 * histórico — mas os botões voltar/avançar da topbar precisam saber se há para
 * onde ir, e o histórico do navegador não diz isso. Esta pilha é só o suficiente
 * para responder a essa pergunta e levar ao caminho certo.
 */

import { useEffect, useState } from "react";

interface StackState {
  stack: string[];
  cursor: number;
}

let state: StackState = { stack: [], cursor: -1 };
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Registra a visita de um caminho (chamado uma vez, no topo do Cider). */
export function useTrackCiderPath(pathname: string): void {
  useEffect(() => {
    const current = state.stack[state.cursor];
    if (pathname === current) return;

    const next = state.stack[state.cursor + 1];
    const previous = state.stack[state.cursor - 1];
    if (pathname === next) {
      state = { ...state, cursor: state.cursor + 1 };
    } else if (pathname === previous) {
      state = { ...state, cursor: state.cursor - 1 };
    } else {
      state = {
        stack: [...state.stack.slice(0, state.cursor + 1), pathname],
        cursor: state.cursor + 1,
      };
    }
    notify();
  }, [pathname]);
}

export interface CiderHistory {
  backPath: string | null;
  forwardPath: string | null;
}

/** Caminhos para onde voltar/avançar, ou `null` quando não há. */
export function useCiderHistory(): CiderHistory {
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    backPath: state.cursor > 0 ? (state.stack[state.cursor - 1] ?? null) : null,
    forwardPath: state.cursor < state.stack.length - 1 ? (state.stack[state.cursor + 1] ?? null) : null,
  };
}

/** Zera a pilha (usado nos testes e ao desmontar o Cider). */
export function resetCiderHistory(): void {
  state = { stack: [], cursor: -1 };
  notify();
}

export const __testing = {
  snapshot: () => state,
};
