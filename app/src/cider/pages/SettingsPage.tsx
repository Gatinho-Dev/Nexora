/**
 * Configurações do Cider.
 *
 * Mesmo desenho do desktop — navegação lateral com seções e grupos de ajuste —
 * com uma diferença de arquitetura: a seção aberta vive na URL
 * (`/cider/configuracoes/casca`), então dá para linkar direto e o botão voltar
 * funciona.
 *
 * Só aparece o que existe de verdade no navegador. Equalizador, DSP, arquivos
 * locais, bandeja e atalhos globais ficaram de fora de propósito: uma seção que
 * não faz nada é pior do que a ausência dela.
 */

import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Activity,
  BarChart3,
  Info,
  Palette,
  PanelRight,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { useCiderSettings } from "../settings/store";
import { useCiderLibrary } from "../library";
import { AppearanceSettings } from "../components/AppearancePanel";
import { Button, Modal, SectionHeader, Slider, Switch } from "../components/primitives";

const SECTIONS = [
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "casca", label: "Casca", icon: PanelRight },
  { id: "reproducao", label: "Reprodução", icon: Play },
  { id: "busca", label: "Busca", icon: Search },
  { id: "biblioteca", label: "Biblioteca e privacidade", icon: ShieldCheck },
  { id: "sobre", label: "Sobre", icon: Info },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function CiderSettingsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const section = (SECTIONS.find((entry) => entry.id === params.section)?.id ?? "aparencia") as SectionId;

  return (
    <div className="page stack gap-6">
      <div className="page-head">
        <div>
          <div className="page-kicker">Sistema</div>
          <h1>Configurações</h1>
          <p className="muted">
            Preferências deste aplicativo, guardadas no armazenamento local do navegador. As
            configurações da Nexora ficam onde sempre estiveram — aqui é só o Cider.
          </p>
        </div>
        <div className="page-actions">
          <Button icon={<BarChart3 size={15} />} onClick={() => navigate("/cider/estatisticas")}>
            Estatísticas
          </Button>
          <Button icon={<Activity size={15} />} onClick={() => navigate("/cider/diagnostico")}>
            Diagnóstico
          </Button>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções das configurações">
          {SECTIONS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                aria-current={section === entry.id ? "true" : undefined}
                onClick={() => navigate(`/cider/configuracoes/${entry.id}`)}
              >
                <Icon size={16} />
                {entry.label}
              </button>
            );
          })}
        </nav>

        <div className="settings-body">
          {section === "aparencia" ? <AppearanceSettings /> : null}
          {section === "casca" ? <ShellSettings /> : null}
          {section === "reproducao" ? <PlaybackSettings /> : null}
          {section === "busca" ? <SearchSettings /> : null}
          {section === "biblioteca" ? <LibrarySettings /> : null}
          {section === "sobre" ? <AboutSettings /> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Casca                                                              *
 * ------------------------------------------------------------------ */

/* Mesma ordem da pílula (transporte, faixa, ações), para a lista de itens aqui
   bater com o que aparece na tela. */
const PLAYBAR_SLOTS: Array<{ id: string; label: string }> = [
  { id: "shuffle", label: "Aleatório" },
  { id: "previous", label: "Faixa anterior" },
  { id: "play", label: "Reproduzir/pausar" },
  { id: "next", label: "Próxima faixa" },
  { id: "repeat", label: "Repetição" },
  { id: "cover", label: "Capa" },
  { id: "favorite", label: "Favoritar" },
  { id: "progress", label: "Barra de progresso" },
  { id: "more", label: "Mais opções" },
  { id: "lyrics", label: "Letras (painel)" },
  { id: "queue", label: "Fila (painel)" },
  { id: "volume", label: "Volume" },
];

function ShellSettings() {
  const settings = useCiderSettings((store) => store.settings);
  const patch = useCiderSettings((store) => store.patch);

  const toggleSlot = (id: string, visible: boolean) => {
    const hidden = visible
      ? settings.playbarHidden.filter((slot) => slot !== id)
      : Array.from(new Set([...settings.playbarHidden, id]));
    patch({ playbarHidden: hidden });
  };

  return (
    <>
      <div className="setting-group">
        <h3>Barra lateral</h3>
        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Visível</span>
            <span className="desc">Esconde a navegação inteira, como no desktop.</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Barra lateral visível"
              checked={settings.sidebarVisible}
              onChange={(value) => patch({ sidebarVisible: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Recolhida</span>
            <span className="desc">Mostra só os ícones, com o nome no `title`.</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Recolher barra lateral"
              checked={settings.sidebarCollapsed}
              onChange={(value) => patch({ sidebarCollapsed: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Posição</span>
          </div>
          <div className="setting-control">
            <div className="segmented" role="group" aria-label="Posição da barra lateral">
              {(
                [
                  ["left", "Esquerda"],
                  ["right", "Direita"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.sidebarPosition === value}
                  onClick={() => patch({ sidebarPosition: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Mostrar rótulos</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Mostrar rótulos"
              checked={settings.sidebarShowLabels}
              onChange={(value) => patch({ sidebarShowLabels: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Redimensionável</span>
            <span className="desc">Permite arrastar a borda para mudar a largura.</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Redimensionável"
              checked={settings.sidebarResizable}
              onChange={(value) => patch({ sidebarResizable: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Largura</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Largura da barra lateral"
              value={settings.sidebarWidth}
              min={180}
              max={380}
              step={4}
              format={(value) => `${value} px`}
              onChange={(value) => patch({ sidebarWidth: value })}
            />
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>Barra de reprodução</h3>
        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Posição</span>
            <span className="desc">Flutuante solta a barra das bordas, com sombra.</span>
          </div>
          <div className="setting-control">
            <div className="segmented" role="group" aria-label="Posição da playbar">
              {(
                [
                  ["bottom", "Colada"],
                  ["floating", "Flutuante"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.playbarPosition === value}
                  onClick={() => patch({ playbarPosition: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Estilo do progresso</span>
          </div>
          <div className="setting-control">
            <div className="segmented" role="group" aria-label="Estilo do progresso">
              {(
                [
                  ["bar", "Barra"],
                  ["thin", "Fina"],
                  ["wave", "Onda"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.progressStyle === value}
                  onClick={() => patch({ progressStyle: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Mostrar tempos</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Mostrar tempos"
              checked={settings.showTimecodes}
              onChange={(value) => patch({ showTimecodes: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Tamanho da capa</span>
          </div>
          <div className="setting-control">
            <Slider
              label="Tamanho da capa"
              value={settings.coverSize}
              min={40}
              max={96}
              step={2}
              format={(value) => `${value} px`}
              onChange={(value) => patch({ coverSize: value })}
            />
          </div>
        </div>

        <div className="setting-row stacked">
          <div className="setting-label">
            <span className="label">Itens da barra de reprodução</span>
            <span className="desc">
              Desligar um item o remove da pílula. A ordem padrão é a do Apple Music — controles à
              esquerda, faixa no meio, ações à direita; a fila e as letras continuam acessíveis pelo
              teclado (Ctrl+Q e Ctrl+L).
            </span>
          </div>
          <div className="setting-control left wrap">
            {PLAYBAR_SLOTS.map((slot) => {
              const visible = !settings.playbarHidden.includes(slot.id);
              return (
                <span key={slot.id} className="inline">
                  <Switch
                    label={slot.label}
                    checked={visible}
                    onChange={(value) => toggleSlot(slot.id, value)}
                  />
                  <span className="small">{slot.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Reprodução                                                         *
 * ------------------------------------------------------------------ */

function PlaybackSettings() {
  const settings = useCiderSettings((store) => store.settings);
  const patch = useCiderSettings((store) => store.patch);

  return (
    <div className="setting-group">
      <h3>Tocando agora</h3>
      <p className="group-hint">
        Aqui ficam só as partes visuais da tela de foco — nada que dependa de acesso ao som, que o
        navegador não dá a uma origem diferente.
      </p>

      <div className="setting-row">
        <div className="setting-label">
          <span className="label">Mostrar letras na página</span>
          <span className="desc">As letras vêm do LRCLIB, sincronizadas por linha e palavra.</span>
        </div>
        <div className="setting-control">
          <Switch
            label="Mostrar letras"
            checked={settings.nowPlayingLyrics}
            onChange={(value) => patch({ nowPlayingLyrics: value })}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span className="label">Visualizador</span>
          <span className="desc">
            O visualizador do desktop lia o áudio antes de sair pela placa de som. Aqui o som vem de
            outra origem, e o navegador não expõe as amostras: o painel aparece com o aviso de que
            não há sinal, em vez de fingir que reage à música.
          </span>
        </div>
        <div className="setting-control">
          <Switch
            label="Visualizador"
            checked={settings.nowPlayingVisualizer}
            onChange={(value) => patch({ nowPlayingVisualizer: value })}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Busca                                                              *
 * ------------------------------------------------------------------ */

function SearchSettings() {
  const settings = useCiderSettings((store) => store.settings);
  const patch = useCiderSettings((store) => store.patch);

  return (
    <div className="setting-group">
      <h3>Busca e ranking</h3>
      <p className="group-hint">
        A busca usa servidores públicos mantidos pela comunidade, sem chave de API. O ranking (nota
        de oficial, detecção de versão, deduplicação e teto por canal) é o mesmo do desktop. A lista
        carrega mais resultados sozinha conforme você rola.
      </p>

      <div className="setting-row">
        <div className="setting-label">
          <span className="label">Preferir áudio oficial</span>
          <span className="desc">Dá prioridade a canais “Topic” e gravações de estúdio.</span>
        </div>
        <div className="setting-control">
          <Switch
            label="Preferir áudio oficial"
            checked={settings.preferOfficialAudio}
            onChange={(value) => patch({ preferOfficialAudio: value })}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span className="label">Esconder versões alternativas</span>
          <span className="desc">Ao vivo, remix, cover, karaokê e versões aceleradas.</span>
        </div>
        <div className="setting-control">
          <Switch
            label="Esconder versões alternativas"
            checked={settings.hideAlternativeVersions}
            onChange={(value) => patch({ hideAlternativeVersions: value })}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span className="label">Máximo por canal</span>
          <span className="desc">Evita que um único canal ocupe a lista inteira.</span>
        </div>
        <div className="setting-control">
          <Slider
            label="Máximo por canal"
            value={settings.maxPerChannel}
            min={0}
            max={20}
            step={1}
            onChange={(value) => patch({ maxPerChannel: value })}
          />
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span className="label">Resultados por consulta</span>
        </div>
        <div className="setting-control">
          <Slider
            label="Resultados por consulta"
            value={settings.searchLimit}
            min={5}
            max={50}
            step={1}
            onChange={(value) => patch({ searchLimit: value })}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Biblioteca e privacidade                                           *
 * ------------------------------------------------------------------ */

function LibrarySettings() {
  const settings = useCiderSettings((store) => store.settings);
  const patch = useCiderSettings((store) => store.patch);
  const reset = useCiderSettings((store) => store.reset);
  const history = useCiderLibrary((store) => store.history);
  const favorites = useCiderLibrary((store) => store.favorites);
  const playlists = useCiderLibrary((store) => store.playlists);
  const clearHistory = useCiderLibrary((store) => store.clearHistory);
  const forgetSearches = useCiderLibrary((store) => store.forgetSearches);
  const [confirm, setConfirm] = useState<null | "historico" | "tudo">(null);

  return (
    <>
      <div className="setting-group">
        <h3>Histórico</h3>
        <p className="group-hint">
          O histórico é local e serve de base para a Home, a Rádio e as Estatísticas. Desligado,
          nada novo é gravado — o que já existe continua lá até você apagar.
        </p>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Gravar histórico</span>
            <span className="desc">{history.length} registro(s) guardados neste navegador.</span>
          </div>
          <div className="setting-control">
            <Switch
              label="Gravar histórico"
              checked={settings.historyEnabled}
              onChange={(value) => patch({ historyEnabled: value })}
            />
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Apagar histórico</span>
            <span className="desc">Favoritos e playlists não são afetados.</span>
          </div>
          <div className="setting-control">
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirm("historico")}>
              Apagar
            </Button>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Buscas recentes</span>
            <span className="desc">Perguntas que você digitou e ficaram guardadas para reuso.</span>
          </div>
          <div className="setting-control">
            <Button icon={<Trash2 size={15} />} onClick={forgetSearches}>
              Limpar buscas
            </Button>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>Aparência e preferências</h3>
        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Restaurar o padrão</span>
            <span className="desc">
              Volta tema, casca, escalas e preferências de busca ao padrão de fábrica. Temas criados
              por você e a biblioteca (histórico, favoritos, playlists) **não** são apagados.
            </span>
          </div>
          <div className="setting-control">
            <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setConfirm("tudo")}>
              Restaurar
            </Button>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Sua biblioteca</span>
            <span className="desc">
              {favorites.length} favorito(s) · {playlists.length} playlist(s) ·{" "}
              {history.length} registro(s) de histórico.
            </span>
          </div>
          <div className="setting-control">
            <span className="badge">local</span>
          </div>
        </div>
      </div>

      <Modal
        open={confirm !== null}
        title={confirm === "tudo" ? "Restaurar o padrão?" : "Apagar o histórico?"}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm === "tudo") reset();
                else clearHistory();
                setConfirm(null);
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <p className="confirm-text">
          {confirm === "tudo"
            ? "As preferências voltam ao padrão de fábrica e o tema ativo volta a ser o Cidra Escura."
            : "Os registros de reprodução deste navegador serão apagados. Favoritos e playlists continuam intactos."}
        </p>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Sobre                                                             *
 * ------------------------------------------------------------------ */

function AboutSettings() {
  const navigate = useNavigate();

  return (
    <>
      <div className="setting-group">
        <h3>Sobre esta versão</h3>
        <p className="group-hint">
          O Cider 2 web é o mesmo produto do aplicativo desktop, rodando onde o áudio funciona: no
          navegador. A razão é técnica e vale registrar — o WebKitGTK do Linux é compilado sem EME,
          então o player recusa o áudio dentro do aplicativo e responde com os erros 152/153 para
          qualquer faixa. No navegador, o Widevine existe e o áudio toca.
        </p>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Player</span>
            <span className="desc">
              Player da fonte de origem, comandado por esta interface e escondido atrás de uma
              camada opaca. Nenhum áudio é baixado, convertido ou hospedado.
            </span>
          </div>
          <div className="setting-control">
            <span className="badge success">som primeiro</span>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Busca</span>
            <span className="desc">
              Servidores públicos da comunidade, sem chave de API e com carregamento progressivo.
            </span>
          </div>
          <div className="setting-control">
            <Button size="sm" icon={<Activity size={14} />} onClick={() => navigate("/cider/diagnostico")}>
              Ver no Diagnóstico
            </Button>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Letras</span>
            <span className="desc">
              LRCLIB, com destaque por palavra e tempo estimado quando a fonte só traz a linha.
            </span>
          </div>
          <div className="setting-control">
            <span className="badge">LRCLIB</span>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-label">
            <span className="label">Presença na Nexora</span>
            <span className="desc">
              A faixa atual aparece no seu perfil, na lista de amigos e no chat. A audiência e o modo
              invisível continuam sendo regras da sua conta na Nexora.
            </span>
          </div>
          <div className="setting-control">
            <Button size="sm" onClick={() => navigate("/settings")}>
              Configurar a conta
            </Button>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>Limitações conhecidas</h3>
        <ul className="stack tight small muted" style={{ paddingLeft: 18 }}>
          <li>
            <strong>Sem equalizador nem DSP.</strong> O navegador não dá acesso ao buffer do áudio
            que está tocando. Qualquer EQ aqui seria decorativo.
          </li>
          <li>
            <strong>Sem arquivos locais.</strong> Não há leitura de disco no navegador; a biblioteca
            é o que você ouviu aqui.
          </li>
          <li>
            <strong>Instâncias caem.</strong> A busca depende de instâncias comunitárias. Quando
            nenhuma responde, a interface diz qual falhou e por quê.
          </li>
          <li>
            <strong>Sem plugins, MPRIS, bandeja e atalhos globais.</strong> Tudo isso dependia do
            núcleo nativo.
          </li>
          <li>
            <strong>Biblioteca por navegador.</strong> Histórico, favoritos e playlists não
            sincronizam entre máquinas nem sobrevivem a "limpar dados do site".
          </li>
        </ul>
      </div>

      <div className="setting-group">
        <h3>Atalhos</h3>
        <div className="api-ref">
          <code>Ctrl + K</code>
          <span>Paleta de comandos (temas, navegação e player).</span>
        </div>
        <div className="api-ref">
          <code>/</code>
          <span>Foca a busca da barra superior.</span>
        </div>
        <div className="api-ref">
          <code>Ctrl + L</code>
          <span>Alterna o painel de letras.</span>
        </div>
        <div className="api-ref">
          <code>Ctrl + Q</code>
          <span>Alterna o painel da fila.</span>
        </div>
        <div className="api-ref">
          <code>Espaço</code>
          <span>Reproduzir/pausar (fora de campos de texto).</span>
        </div>
        <div className="api-ref">
          <code>Ctrl + ← / →</code>
          <span>Faixa anterior / próxima.</span>
        </div>
        <div className="api-ref">
          <code>Esc</code>
          <span>Fecha a paleta, o painel ou o modo imersivo.</span>
        </div>
      </div>

      <SectionHeader title="Créditos" />
      <div className="notice">
        <SlidersHorizontal size={18} />
        <div>
          Interface, tokens de design, ranking de busca, motor de letras e os seis temas embutidos
          foram portados do Cider 2 desktop — mesmo projeto, mesma identidade. O Cider não é
          afiliado a nenhum dos provedores de conteúdo que consulta, e preserva a atribuição de cada
          faixa, com o título original e o link para a publicação.
        </div>
      </div>
    </>
  );
}
