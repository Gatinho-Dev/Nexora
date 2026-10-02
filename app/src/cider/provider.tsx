/**
 * Estado do player do Cider, compartilhado por todo o site.
 *
 * Fica num provider próprio, **acima do roteador**, por três motivos:
 *
 * 1. o `<iframe>` do YouTube não pode ser desmontado quando a rota muda — se
 *    fosse, o áudio pararia ao navegar entre as telas do Cider ou para a Nexora;
 * 2. o mini-player e o dock precisam do mesmo estado para não criar um segundo
 *    player;
 * 3. a aparência (tema) e as cores da capa valem para o aplicativo inteiro,
 *    inclusive para o que aparece fora de `/cider`.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";

import { createCiderEngine, type CiderEngine, type PlayerSnapshot } from "./engine";
import { CiderContext } from "./context";
import { publishNowPlaying, resetNowPlaying } from "./activity";
import { CiderAudioDock } from "./components/AudioDock";
import { extractPalette } from "./color";
import { recordPlay } from "./play";
import { applyAccentFromCover } from "./settings/apply";
import { useCiderAppearanceSync, useCiderSettings } from "./settings/store";

const EMPTY: PlayerSnapshot = {
  phase: "idle",
  error: null,
  positionMs: 0,
  durationMs: 0,
  track: null,
  queue: [],
  manual: [],
  index: -1,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off",
  autoplayBlocked: false,
};

export function CiderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerSnapshot>(EMPTY);
  const location = useLocation();
  // O motor nasce no `useState` (e não em um `useRef` lido durante o render)
  // porque criar player durante o render é o que a regra de refs proíbe — e o
  // inicializador do `useState` roda uma vez só, que é o que queremos.
  const [engine] = useState<CiderEngine>(() => createCiderEngine());

  // O dock — e portanto o `<iframe>` do player — só existe dentro de `/cider`
  // ou quando há faixa carregada.
  //
  // Os dois lados disso importam. Criar o `<iframe>` em **toda** página da
  // Nexora carregava um player à toa fora do Cider (era o "player flutuante"
  // que aparecia no meio da interface). E desmontá-lo com música tocando
  // destruiria exatamente o nó que mantém o áudio vivo: a IFrame Player API
  // substitui o host pelo iframe, então o motor ficaria apontando para um
  // elemento fora do documento. Com a faixa carregada o dock permanece, e ao
  // sair de `/cider` o áudio continua — o `YouTubePlayer.mount` ainda detecta
  // host desconectado e recria o player, para o caso de montar e desmontar sem
  // faixa nenhuma.
  const onCiderRoute = location.pathname.startsWith("/cider");
  const dockEnabled = onCiderRoute || state.track !== null;

  // Tema aplicado ao `<html>` desde o primeiro render: vale também para o
  // mini-player, que vive fora de `/cider`.
  useCiderAppearanceSync();

  useEffect(() => {
    engine.onActivity((track, playing) => {
      const snapshot = engine.snapshot();
      publishNowPlaying(track, {
        playing,
        positionMs: snapshot.positionMs,
        durationMs: snapshot.durationMs,
      });
      // O histórico grava quando a faixa realmente começa a tocar: pausar e
      // voltar não é uma segunda reprodução, e o próprio histórico deduplica
      // a sequência repetida.
      if (playing && track) recordPlay(track);
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
    [engine],
  );

  // --- Cores da capa -------------------------------------------------
  const coverUrl = state.track?.artworkUrl ?? null;
  const followCover = useCiderSettings((store) => store.settings.themeFollowCover);
  const mode = useCiderSettings((store) => store.appearance?.mode ?? "dark");

  useEffect(() => {
    if (!followCover || !coverUrl) {
      // Reaplica o tema: é o caminho correto de volta, porque o destaque pode
      // vir de um token do tema e não das configurações.
      useCiderSettings.getState().apply();
      return;
    }
    let alive = true;
    void extractPalette(coverUrl, mode).then((palette) => {
      if (!alive) return;
      if (palette) applyAccentFromCover(palette.accent, palette.secondary);
      else useCiderSettings.getState().apply();
    });
    return () => {
      alive = false;
    };
  }, [coverUrl, followCover, mode]);

  const value = useMemo(() => ({ state, engine }), [state, engine]);

  return (
    <CiderContext.Provider value={value}>
      {dockEnabled ? <CiderAudioDock /> : null}
      {children}
    </CiderContext.Provider>
  );
}
