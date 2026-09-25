import { useState } from "react";
import { toast } from "sonner";
import { soundManager, type SoundEvent } from "@/lib/sound";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DiscordCard,
  DiscordDivider,
  DiscordPageHeader,
  DiscordSectionTitle,
  DiscordSlider,
  DiscordToggle,
} from "@/components/settings/DiscordSettings";

const SOUND_EVENTS: readonly (readonly [string, string])[] = [
  ["join", "Entrada na chamada"],
  ["leave", "Saída da chamada"],
  ["mute", "Microfone mutado"],
  ["unmute", "Microfone desmutado"],
  ["deafen", "Áudio ensurdecido"],
  ["undeafen", "Áudio ativado"],
  ["dm-message", "Mensagens diretas"],
  ["notification", "Menções e notificações"],
  ["screen-start", "Compartilhamento de tela iniciado"],
];

/**
 * "Notificações" — sons, notificações do sistema e renderização de texto.
 *
 * Os sons usam o `soundManager` (localStorage) porque são estado de hardware
 * do dispositivo; as substituições e o bloco "Texto e imagens" usam a store
 * global, sincronizada com debounce.
 */
export function NotificationsTab() {
  const [prefs, setPrefs] = useState(() => soundManager.getPrefs());
  const {
    suppressSoundWhenFocused,
    messagePreview,
    notificationFlash,
    linkEmbeds,
    showStickers,
    convertEmoticons,
    messageGrouping,
  } = useSettingsStore(state => state.settings);
  const patch = useSettingsStore(state => state.patch);
  const supported = typeof Notification !== "undefined";
  const [permission, setPermission] = useState<
    "granted" | "denied" | "default" | "unsupported"
  >(() => (supported ? Notification.permission : "unsupported"));

  const updateSound = (
    soundPatch: Partial<ReturnType<typeof soundManager.getPrefs>>
  ) => {
    soundManager.savePrefs(soundPatch);
    setPrefs(soundManager.getPrefs());
  };

  const enableDesktopNotifications = async () => {
    if (!supported) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Notificações do computador ativadas!");
        localStorage.setItem("nexora-desktop-notif-asked", "1");
      }
    } catch {
      toast.error("Não foi possível pedir permissão agora.");
    }
  };

  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Notificações e Som"
        description="Efeitos sonoros, notificações do sistema e como as mensagens são renderizadas."
      />

      <DiscordCard>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">
              Notificações na área de trabalho
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#B5BAC1]">
              {permission === "granted"
                ? "Ativas: você recebe avisos do sistema quando a aba está em segundo plano."
                : permission === "denied"
                  ? "Bloqueadas pelo navegador. Libere as notificações deste site nas permissões do navegador."
                  : permission === "unsupported"
                    ? "Seu navegador não suporta notificações."
                    : "Receba avisos no PC mesmo com a Nexora em segundo plano."}
            </p>
          </div>
          {permission === "granted" || permission === "unsupported" ? (
            <Switch
              disabled={permission === "unsupported"}
              checked={permission === "granted"}
              onCheckedChange={() => {
                if (!supported) return;
                if (Notification.permission === "default") {
                  void enableDesktopNotifications();
                } else if (Notification.permission === "denied") {
                  toast.error(
                    "As notificações foram bloqueadas nas permissões do navegador."
                  );
                }
              }}
              aria-label="Notificações na área de trabalho"
            />
          ) : (
            <Button
              size="sm"
              onClick={() => void enableDesktopNotifications()}
              className="shrink-0 bg-[#5865F2] text-white hover:bg-[#4752C4]"
            >
              Ativar
            </Button>
          )}
        </div>
      </DiscordCard>

      <DiscordCard
        title="Efeitos sonoros"
        description="Sons de chamadas, mutes, mensagens diretas e avisos da Nexora."
      >
        <DiscordToggle
          label="Ativar efeitos sonoros"
          checked={prefs.enabled}
          onCheckedChange={enabled => updateSound({ enabled })}
        />
        <DiscordDivider />
        <DiscordSlider
          label="Volume dos sons"
          value={prefs.masterVolume}
          min={0}
          max={100}
          step={1}
          formatValue={value => `${value}%`}
          hints={["Mudo", "Alto"]}
          onChange={value => updateSound({ masterVolume: value })}
        />
        <DiscordDivider />
        <div className="px-4 py-2">
          <DiscordSectionTitle>Eventos individuais</DiscordSectionTitle>
          <div className="mt-2 divide-y divide-black/20 rounded-lg bg-[#1E1F22] px-4">
            {SOUND_EVENTS.map(([eventKey, label]) => (
              <DiscordToggle
                key={eventKey}
                label={label}
                checked={prefs.events[eventKey as SoundEvent] ?? true}
                onCheckedChange={value =>
                  updateSound({
                    events: { ...prefs.events, [eventKey]: value },
                  })
                }
              />
            ))}
          </div>
        </div>
      </DiscordCard>

      <DiscordCard
        title="Substituições"
        description="Regras que vencem os eventos acima quando a aba do canal já está aberta e em uso."
      >
        <DiscordToggle
          label="Silenciar sons com a aba do canal visível"
          description="Com a aba ativa, a mensagem aparece mas não toca som — a não ser que a janela da Nexora esteja em segundo plano."
          checked={suppressSoundWhenFocused}
          onCheckedChange={value => patch({ suppressSoundWhenFocused: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Pré-visualizar mensagens nas notificações"
          description="Inclui o texto da mensagem no aviso do sistema quando o canal não está aberto."
          checked={messagePreview}
          onCheckedChange={value => patch({ messagePreview: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Destacar a aba na notificação"
          description="Pisca a barra de título quando chega uma mensagem nova."
          checked={notificationFlash}
          onCheckedChange={value => patch({ notificationFlash: value })}
        />
      </DiscordCard>

      <DiscordCard
        title="Texto e imagens"
        description="Economiza memória e ruído em conversas muito longas."
      >
        <DiscordToggle
          label="Pré-visualizar links"
          description="Gera cartões com título e imagem dos sites enviados."
          checked={linkEmbeds}
          onCheckedChange={value => patch({ linkEmbeds: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Mostrar stickers"
          description="Desligado, o sticker é enviado apenas como texto."
          checked={showStickers}
          onCheckedChange={value => patch({ showStickers: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Converter emoticons em emoji"
          description="Troca :) por 🙂 automaticamente na escrita e na leitura."
          checked={convertEmoticons}
          onCheckedChange={value => patch({ convertEmoticons: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Agrupar mensagens consecutivas"
          description="Mensagens seguidas da mesma pessoa compartilham avatar e cabeçalho."
          checked={messageGrouping}
          onCheckedChange={value => patch({ messageGrouping: value })}
        />
      </DiscordCard>
    </div>
  );
}
