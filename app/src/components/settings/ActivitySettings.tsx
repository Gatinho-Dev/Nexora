import { useState } from "react";
import { Gamepad2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  CUSTOM_GAME_PREFIX,
  REGISTERED_GAME_CATALOG,
  isCustomGameId,
} from "@/lib/clientSettings";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Switch } from "@/components/ui/switch";
import {
  DiscordCard,
  DiscordDivider,
  DiscordPageHeader,
  DiscordSectionTitle,
  DiscordSlider,
  DiscordToggle,
} from "@/components/settings/DiscordSettings";

function customLabel(id: string) {
  return id.slice(CUSTOM_GAME_PREFIX.length);
}

/**
 * "Privacidade de Atividade" — o toggle mestre do Rich Presence.
 */
export function ActivityPrivacyTab({ onNavigate }: { onNavigate: (tab: "registered-games") => void }) {
  const shareGameActivity = useSettingsStore(state => state.settings.shareGameActivity);
  const registeredGames = useSettingsStore(state => state.settings.registeredGames);
  const patch = useSettingsStore(state => state.patch);

  return (
    <div className="space-y-6">
      <DiscordPageHeader
        title="Privacidade de Atividade"
        description="Decida se a Nexora pode anexar o que você está jogando ao seu status visível."
      />

      <DiscordCard
        tone={shareGameActivity ? "accent" : "default"}
        title="Compartilhar jogos em segundo plano"
        description="Quando desativado, nenhum título aparece no seu perfil — nem em conversas diretas, nem em servidores, nem no overlay."
      >
        <DiscordToggle
          label="Mostrar o que estou jogando"
          description="A Nexora lê a lista de executáveis em memória e compara com as assinaturas registradas."
          checked={shareGameActivity}
          onCheckedChange={value => patch({ shareGameActivity: value })}
        />
      </DiscordCard>

      <DiscordCard
        title="Jogos registrados"
        description={`${registeredGames.length} ${registeredGames.length === 1 ? "jogo registrado" : "jogos registrados"} nesta conta.`}
      >
        <button
          type="button"
          onClick={() => onNavigate("registered-games")}
          className="min-h-11 w-full rounded-lg bg-[#5865F2] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#4752C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
        >
          Gerenciar jogos registrados
        </button>
      </DiscordCard>
    </div>
  );
}

/**
 * "Jogos Registrados" — lista de títulos, entradas livres e overlay de jogo.
 */
export function RegisteredGamesTab() {
  const settings = useSettingsStore(state => state.settings);
  const patch = useSettingsStore(state => state.patch);
  const [draft, setDraft] = useState("");

  const customEntries = settings.registeredGames.filter(isCustomGameId);
  const toggleGame = (id: string) => {
    const next = settings.registeredGames.includes(id)
      ? settings.registeredGames.filter(entry => entry !== id)
      : [...settings.registeredGames, id];
    patch({ registeredGames: next });
  };

  const addCustom = () => {
    const executable = draft.trim();
    if (!executable) return;
    const id = `${CUSTOM_GAME_PREFIX}${executable}`;
    if (settings.registeredGames.includes(id)) {
      toast.info("Esse executável já está pareado.");
      return;
    }
    patch({ registeredGames: [...settings.registeredGames, id] });
    setDraft("");
    toast.success("Executável pareado com o Rich Presence.");
  };

  return (
    <div className="space-y-6">
      <DiscordPageHeader
        title="Jogos Registrados"
        description="Ative ou desative títulos individualmente. A leitura de executáveis é local e só alimenta o seu próprio status."
      />

      {!settings.shareGameActivity && (
        <p className="rounded-lg border border-[#FEE75C]/30 bg-[#FEE75C]/10 px-4 py-3 text-[11px] leading-relaxed text-[#FEE75C]">
          O compartilhamento de atividade está desligado em Privacidade de Atividade.
          Você pode manter a lista aqui, mas nada será exibido.
        </p>
      )}

      <DiscordCard
        title="Jogos de PC conhecidos"
        description="Descobertos pela comparação dos executáveis em memória."
      >
        <ul className="divide-y divide-black/20">
          {REGISTERED_GAME_CATALOG.map(game => {
            const enabled = settings.registeredGames.includes(game.id);
            return (
              <li
                key={game.id}
                className="flex min-h-14 items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {game.name}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[#949BA4]">
                    {game.executables.join(", ")}
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleGame(game.id)}
                  aria-label={`Registrar ${game.name}`}
                />
              </li>
            );
          })}
        </ul>
      </DiscordCard>

      <DiscordCard
        title="Adicionar executável"
        description="Pareie um arquivo que ainda não está no catálogo (o caminho precisa existir no PC onde você joga)."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="C:\\Jogos\\meu-jogo\\game.exe"
            aria-label="Caminho do executável"
            className="min-h-11 flex-1 rounded-lg border border-black/20 bg-[#1E1F22] px-3 text-[13px] text-white placeholder:text-[#949BA4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!draft.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            Adicionar
          </button>
        </div>
        {customEntries.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {customEntries.map(id => (
              <li
                key={id}
                className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-[#1E1F22] px-3"
              >
                <span className="truncate font-mono text-[11px] text-[#B5BAC1]">
                  {customLabel(id)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGame(id)}
                  aria-label={`Remover ${customLabel(id)}`}
                  className="grid size-8 place-items-center rounded-lg text-[#B5BAC1] transition-colors hover:bg-white/5 hover:text-[#ED4245]"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </DiscordCard>

      <DiscordCard
        title="Sobreposição de jogo"
        description="Insere elementos Nexora dentro da janela do jogo, sobre a captura do jogo."
      >
        <DiscordToggle
          label="Ativar sobreposição de jogo"
          description="Exige captura de tela do sistema e pode cair abaixo de 30 fps em jogos mais pesados."
          checked={settings.gameOverlay}
          onCheckedChange={value => patch({ gameOverlay: value })}
        />
        <DiscordDivider />
        <DiscordSlider
          label="Opacidade da sobreposição"
          value={settings.attenuation}
          min={0}
          max={100}
          step={5}
          formatValue={value => `${value}%`}
          hints={["Transparente", "Opaca"]}
          onChange={value => patch({ attenuation: value })}
        />
      </DiscordCard>

      <section className="space-y-2">
        <DiscordSectionTitle>Como funciona</DiscordSectionTitle>
        <p className="flex items-start gap-2 rounded-lg bg-[#232428] px-4 py-3 text-[11px] leading-relaxed text-[#B5BAC1]">
          <Gamepad2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          A varredura acontece no navegador: ele compara a lista de executáveis
          com as assinaturas acima. Nada é enviado para fora do seu dispositivo além
          do título correspondente, e apenas quando o compartilhamento está ligado.
        </p>
      </section>
    </div>
  );
}
