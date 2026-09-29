/**
 * Estado do player do Cider, compartilhado por `/cider` e pelo mini-player.
 *
 * Fica num provider próprio, **fora** do roteador, por dois motivos:
 *
 * 1. o `<iframe>` do YouTube não pode ser desmontado quando a rota muda — se
 *    fosse, o áudio pararia ao navegar para o Nexora;
 * 2. o mini-player precisa ler o mesmo estado para não criar um segundo player.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createCiderEngine, type CiderEngine, type PlayerSnapshot } from "./engine";
import { CiderContext } from "./context";
import { publishNowPlaying, resetNowPlaying } from "./activity";

const EMPTY: PlayerSnapshot = {
  phase: "idle",
  error: null,
  positionMs: 0,
  durationMs: 0,
  track: null,
  queue: [],
  index: -1,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off",
  autoplayBlocked: false,
};




export function CiderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerSnapshot>(EMPTY);
  // O motor nasce no `useState` (e não em um `useRef` lido durante o render)
  // porque criar player durante o render é o que a regra de refs proíbe — e o
  // inicializador do `useState` roda uma vez só, que é o que queremos.
  const [engine] = useState<CiderEngine>(() => createCiderEngine());

  useEffect(() => {
    engine.onActivity((track, playing) => {
      const snapshot = engine.snapshot();
      publishNowPlaying(track, {
        playing,
        positionMs: snapshot.positionMs,
        durationMs: snapshot.durationMs,
      });
    });
  }, [engine]);

  useEffect(() => engine.subscribe(setState), [engine]);

  useEffect(
    () => () => {
      // Só quando o provider inteiro vai embora (logout, recarregar o app):
      // sair de /cider não pode derrubar a reprodução.
      engine.dispose();
      resetNowPlaying();
    },
    [engine]
  );

  const value = useMemo(() => ({ state, engine }), [state, engine]);

  return (
    <CiderContext.Provider value={value}>{children}</CiderContext.Provider>
  );
}
