/**
 * Guia de primeira execução.
 *
 * Mesmo papel do assistente do desktop — apresentar o aplicativo e deixar a
 * pessoa escolher a aparência antes de usar —, com os passos que fazem sentido
 * na versão web: aqui o áudio vem do player oficial dentro do navegador, e não
 * de arquivos locais. O guia aparece uma vez (`onboardingSeen`).
 */

import { useState } from "react";
import { Palette, Play, ShieldCheck } from "lucide-react";

import { useCiderSettings } from "../settings/store";
import { useCiderUi } from "../ui";
import { Button } from "./primitives";

const STEPS = ["Boas-vindas", "Como o áudio toca", "Sua biblioteca"] as const;

export function CiderOnboarding() {
  const open = useCiderUi((state) => state.onboarding);
  const setOpen = useCiderUi((state) => state.setOnboarding);
  const patch = useCiderSettings((state) => state.patch);
  const themes = useCiderSettings((state) => state.themes);
  const activeTheme = useCiderSettings((state) => state.settings.theme);
  const selectTheme = useCiderSettings((state) => state.selectTheme);
  const [step, setStep] = useState(0);

  if (!open) return null;

  const finish = () => {
    patch({ onboardingSeen: true });
    setOpen(false);
    setStep(0);
  };

  return (
    <div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label="Primeiros passos do Cider">
      <div className="wizard">
        <div className="wizard-head">
          <span className="badge accent">Cider 2 · web</span>
          <div className="wizard-steps" aria-hidden="true">
            {STEPS.map((name, index) => (
              <span key={name} className={index <= step ? "done" : undefined} />
            ))}
          </div>
        </div>

        <div className="wizard-body">
          {step === 0 ? (
            <section className="wizard-step">
              <h2>Escolha o tema</h2>
              <p>
                O Cider web usa os mesmos temas do Cider 2 desktop. Dá para trocar depois em
                Configurações → Aparência, criar o seu e editar cada token de design.
              </p>
              <div className="wizard-options">
                <button
                  type="button"
                  className="option-card"
                  aria-pressed={activeTheme === "auto"}
                  onClick={() => selectTheme("auto")}
                >
                  <strong>Automático</strong>
                  <span>Segue o claro/escuro do sistema operacional.</span>
                </button>
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className="option-card"
                    aria-pressed={activeTheme === theme.id}
                    onClick={() => selectTheme(theme.id)}
                  >
                    <strong>
                      <Palette size={14} /> {theme.name}
                    </strong>
                    <span>{theme.description ?? (theme.mode === "light" ? "Tema claro" : "Tema escuro")}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="wizard-step">
              <h2>O áudio toca sem baixar nada</h2>
              <p>
                O Cider web não baixa, não converte e não hospeda áudio: quem toca é o player da
                fonte, comandado por esta interface, e a capa fica por cima — a tela é toda da
                música.
              </p>
              <div className="stack">
                <div className="notice" data-tone="info">
                  <Play size={18} />
                  <div>
                    <strong>O primeiro play precisa de um clique</strong>
                    <br />
                    Isso é política de autoplay do navegador, não uma escolha do Cider. Depois do
                    primeiro clique, a fila avança sozinha.
                  </div>
                </div>
                <div className="notice" data-tone="info">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>A busca é sem chave</strong>
                    <br />
                    Os metadados vêm de servidores públicos mantidos pela comunidade. Eles caem de
                    vez em quando — quando isso acontece, o Cider diz exatamente onde falhou em vez
                    de mostrar uma lista vazia sem explicação.
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="wizard-step">
              <h2>Sua biblioteca é deste navegador</h2>
              <p>
                Histórico, favoritos e playlists ficam no armazenamento local do navegador — como o
                SQLite do desktop, mas sem sincronizar entre máquinas. O que você ouve também
                aparece na Nexora, no seu perfil e para os seus amigos, como uma atividade.
              </p>
              <div className="notice" data-tone="warning">
                <div>
                  <strong>Limitações desta versão</strong>
                  <br />
                  Sem equalizador (o navegador não dá acesso ao áudio que está tocando), sem
                  arquivos locais, sem plugins e sem atalhos globais de sistema. O Diagnóstico mostra o que
                  está funcionando na sua máquina agora.
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="wizard-foot">
          <Button variant="ghost" onClick={finish}>
            Pular
          </Button>
          <div className="inline">
            {step > 0 ? (
              <Button onClick={() => setStep((value) => value - 1)}>Voltar</Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => setStep((value) => value + 1)}>
                Próximo
              </Button>
            ) : (
              <Button variant="primary" onClick={finish}>
                Começar a ouvir
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
