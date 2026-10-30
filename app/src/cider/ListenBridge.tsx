/**
 * A ponte de "Ouvir junto" com o motor e o realtime.
 *
 * É um componente — e não um efeito dentro do provider — por um motivo prático:
 * ele precisa de `useCider()` para chegar ao motor que vive acima do roteador, e
 * de um lugar só para montar e desmontar as assinaturas. A lógica em si mora em
 * `listen.ts`, que não conhece React; aqui só ficam os ciclos de vida.
 */

import { useEffect } from "react";

import { attachListenEngine, pruneListenReactions, useCiderListen } from "./listen";
import { useCider } from "./useCider";

export function CiderListenBridge() {
  const { engine } = useCider();
  const reactionCount = useCiderListen((store) => store.reactions.length);

  useEffect(() => attachListenEngine(engine), [engine]);

  // As reações somem sozinhas: a limpeza só precisa rodar enquanto há alguma.
  useEffect(() => {
    if (reactionCount === 0) return undefined;
    const timer = window.setInterval(() => pruneListenReactions(), 600);
    return () => window.clearInterval(timer);
  }, [reactionCount]);

  return null;
}
