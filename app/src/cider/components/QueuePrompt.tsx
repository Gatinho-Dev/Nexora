/**
 * A pergunta que a interface faz antes de jogar fora o que foi posto à mão.
 *
 * Existe uma só: "Reproduzir isto limpará a sua fila". É a correção que o iOS 18
 * trouxe para o acidente mais irritante de um player — começar um álbum apagava
 * em silêncio a fila que a pessoa tinha montado. Aqui ela aparece **só quando há
 * o que perder** (ver `requestPlay`, em `play.ts`), então tocar um álbum com a
 * fila limpa continua sendo um clique.
 *
 * A caixa é a mesma do resto do Cider (o `Modal`), o botão de confirmar diz o que
 * faz (nunca "OK") e o foco começa em **Cancelar**: quem chegou aqui não pediu
 * para trocar a fila, pediu para tocar uma música — o caminho de volta tem de ser
 * o mais fácil, e `Enter` precisa ser seguro.
 */

import { useCiderUi } from "../ui";
import { Button, Modal } from "./primitives";

export function CiderQueuePrompt() {
  const prompt = useCiderUi((state) => state.queuePrompt);
  const dismiss = useCiderUi((state) => state.dismissQueuePrompt);

  if (!prompt) return null;

  return (
    <Modal
      open
      title={prompt.title}
      onClose={dismiss}
      footer={
        <>
          <Button variant="ghost" autoFocus onClick={dismiss}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              dismiss();
              prompt.onConfirm();
            }}
          >
            {prompt.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="muted small" style={{ margin: 0 }}>
        {prompt.message}
      </p>
    </Modal>
  );
}
