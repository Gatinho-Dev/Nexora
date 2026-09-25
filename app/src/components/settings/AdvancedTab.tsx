import { toast } from "sonner";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEFAULT_DEVICE_PREFS, setDevicePrefs } from "@/lib/devices";
import { getTheme } from "@/lib/theme";
import {
  applyAppearancePreferences,
  DEFAULT_APPEARANCE_PREFERENCES,
} from "@/lib/appearancePreferences";
import {
  DiscordCard,
  DiscordDangerButton,
  DiscordDivider,
  DiscordPageHeader,
  DiscordToggle,
} from "@/components/settings/DiscordSettings";

/**
 * "Avançado e Modo Streamer".
 *
 * O botão de redefinição restaura o estado local de todos os grupos do modal
 * (aparência, acessibilidade, voz/vídeo, notificações, avançado e atividade)
 * e dispara um toast; o servidor é reidratado na próxima sincronização.
 */
export function AdvancedTab() {
  const { hardwareAcceleration, developerMode, hideCriticalData } =
    useSettingsStore(state => state.settings);
  const patch = useSettingsStore(state => state.patch);
  const reset = useSettingsStore(state => state.reset);

  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Avançado e Modo Streamer"
        description="Desempenho, ferramentas de diagnóstico e o botão de recuperação de estado."
      />

      <DiscordCard
        title="Desempenho"
        description="A aceleração por GPU deixa chamadas e captura de tela mais leves, ao custo de mais uso de memória."
      >
        <DiscordToggle
          label="Aceleração de hardware"
          description="Desativar pode corrigir tela preta na captura, mas aumenta o uso de CPU."
          checked={hardwareAcceleration}
          onCheckedChange={value => patch({ hardwareAcceleration: value })}
        />
      </DiscordCard>

      <DiscordCard
        title="Modo desenvolvedor"
        description="Ferramentas de diagnóstico adicionais. Mantenha ligado apenas em um ambiente de testes."
      >
        <DiscordToggle
          label="Ativar modo desenvolvedor"
          description="Libera a cópia de identificadores e estatísticas WebRTC detalhadas."
          checked={developerMode}
          onCheckedChange={value => patch({ developerMode: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Ocultar dados críticos"
          description="Mascara tokens, e-mails e identificadores nas telas de diagnóstico — inclusive no seu compartilhamento de tela."
          checked={hideCriticalData}
          onCheckedChange={value => patch({ hideCriticalData: value })}
        />
      </DiscordCard>

      <DiscordCard
        tone="danger"
        title="Redefinir configurações de Voz e Vídeo"
        description="Devolve Aparência, Acessibilidade, Voz e vídeo, Notificações, Avançado e Atividade aos valores padrão desta conta."
      >
        <div className="flex flex-wrap items-center gap-3">
          <DiscordDangerButton
            onClick={() => {
              reset();
              applyAppearancePreferences({
                ...DEFAULT_APPEARANCE_PREFERENCES,
                theme: getTheme(),
              });
              setDevicePrefs({ ...DEFAULT_DEVICE_PREFS });
              toast.success("Preferências locais restauradas para o padrão.");
            }}
          >
            Redefinir configurações de Voz e Vídeo
          </DiscordDangerButton>
          <p className="max-w-sm text-[10px] leading-relaxed text-[#949BA4]">
            Arquivos locais são apagados; o que estiver salvo no servidor volta na
            próxima sincronização.
          </p>
        </div>
      </DiscordCard>
    </div>
  );
}
