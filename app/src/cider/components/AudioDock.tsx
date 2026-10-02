/**
 * Dock do player: onde o `<iframe>` do YouTube realmente vive.
 *
 * Existe por um motivo técnico que decide o produto: a IFrame Player API
 * **substitui o elemento host** pelo próprio `<iframe>`. Se esse host estiver
 * dentro da página `/cider`, sair para o Nexora o desmonta — e a música para,
 * mesmo com o motor e o mini-player vivos. Por isso o host mora aqui, no
 * provider acima do roteador: ele nunca é desmontado, então o áudio sobrevive à
 * navegação.
 *
 * O iframe precisa de **área real** — `display: none` e 0×0 impedem a
 * inicialização — mas o vídeo **nunca** pode aparecer. A solução é uma faixa de
 * verdade (344×56 px, canto inferior direito, veja `styles/web.css`) com
 * `opacity: 0`: invisível para o olho e para o empilhamento da página, viva para
 * o player. O véu por dentro é a segunda barreira, caso a opacidade volte.
 *
 * Por isso este componente não sabe se há faixa tocando: com ou sem faixa ele
 * fica igualmente invisível, e não esconder/desmontar o player é justamente o
 * que mantém o áudio vivo.
 */

import { useEffect, useRef } from "react";

import { useCider } from "../useCider";
import { ciderToast } from "../ui";

export function CiderAudioDock() {
  const { state, engine } = useCider();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mounted.current) return;
    mounted.current = true;
    void engine.mount(host).catch((error: unknown) => {
      mounted.current = false;
      ciderToast(
        "error",
        "Não foi possível carregar o player",
        error instanceof Error ? error.message : String(error),
        { timeoutMs: 12000 },
      );
    });
  }, [engine]);

  return (
    <div
      className="cider-audio-dock"
      data-active={state.track ? "true" : "false"}
      aria-hidden="true"
    >
      <div ref={hostRef} className="youtube-frame-host" />
      <div className="cider-audio-veil" />
    </div>
  );
}
