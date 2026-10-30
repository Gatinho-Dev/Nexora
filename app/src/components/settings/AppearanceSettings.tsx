import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { getTheme, type Theme } from "@/lib/theme";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  applyAppearancePreferences,
  DEFAULT_APPEARANCE_PREFERENCES,
  parseAppearancePreferences,
  type AppearancePreferences,
} from "@/lib/appearancePreferences";
import {
  DiscordCard,
  DiscordDivider,
  DiscordPageHeader,
  DiscordSlider,
  DiscordToggle,
} from "@/components/settings/DiscordSettings";

/**
 * "Aparência" — tema, densidade e escala. Os sliders de fonte e espaçamento
 * aplicam na hora e só sincronizam ao servidor no `onValueCommit`, evitando
 * uma escrita por pixel arrastado.
 */
export function AppearanceTab() {
  const utils = trpc.useUtils();
  const preferences = trpc.advanced.profile.preferences.useQuery();
  const [appearance, setAppearance] = useState<AppearancePreferences>(() => ({
    ...DEFAULT_APPEARANCE_PREFERENCES,
    theme: getTheme(),
  }));
  const update = trpc.advanced.profile.updatePreferences.useMutation({
    onSuccess: result => {
      utils.advanced.profile.preferences.setData(undefined, current =>
        current
          ? {
              ...current,
              data: result.data,
              version: result.version,
              updatedAt: new Date(),
            }
          : current
      );
      toast.success("Aparência sincronizada.");
    },
    onError: error => {
      if (error.data?.code === "CONFLICT") void preferences.refetch();
      toast.error(error.message || "Não foi possível salvar a aparência.");
    },
  });

  // A query resolve de forma assíncrona. Ajustar o estado durante o render (o
  // padrão do React para derivar estado de uma entrada que muda) evita o efeito
  // em cascata; comparar a versão do servidor evita reidratar a cada render.
  const serverVersion = preferences.data?.version ?? null;
  const [hydratedVersion, setHydratedVersion] = useState<number | null>(null);
  if (preferences.data && serverVersion !== hydratedVersion) {
    setHydratedVersion(serverVersion);
    setAppearance(parseAppearancePreferences(preferences.data.data));
  }

  // Efeito colateral puro: `appearance` é a fonte, e o DOM sempre reflete ela —
  // inclusive nos sliders, que só chamam `setAppearance` (edição otimista).
  useEffect(() => {
    applyAppearancePreferences(appearance);
  }, [appearance]);

  const save = (patch: Partial<AppearancePreferences>) => {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    update.mutate({
      expectedVersion: preferences.data?.version ?? 0,
      data: { ...(preferences.data?.data ?? {}), appearance: next },
    });
  };

  const options: {
    id: Theme;
    label: string;
    description: string;
    icon: typeof Moon;
  }[] = [
    {
      id: "dark",
      label: "Escuro Nexora",
      description: "Tema escuro oficial da Nexora com detalhes luminosos.",
      icon: Moon,
    },
    {
      id: "light",
      label: "Claro",
      description: "Visual claro para ambientes iluminados.",
      icon: Sun,
    },
    {
      id: "system",
      label: "Sistema",
      description: "Acompanha o modo do sistema operacional.",
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Aparência da Nexora"
        description="Tema, densidade das mensagens e escala da interface."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => save({ theme: opt.id })}
            className={cn(
              "relative overflow-hidden rounded-lg border p-4 text-left transition-colors",
              appearance.theme === opt.id
                ? "border-[#5865F2] bg-[#5865F2]/10 text-white"
                : "border-black/15 bg-[#232428] text-[#B5BAC1] hover:border-white/20 hover:text-white"
            )}
          >
            <opt.icon className="mb-2 h-5 w-5 text-[#5865F2]" aria-hidden />
            <p className="text-sm font-bold text-white">{opt.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-[#B5BAC1]">
              {opt.description}
            </p>
            {appearance.theme === opt.id && (
              <span className="absolute right-2 top-2 text-[#5865F2]">
                <Check className="h-4 w-4" aria-hidden />
              </span>
            )}
          </button>
        ))}
      </div>

      <DiscordCard
        title="Densidade das mensagens"
        description="Aconchegante mostra avatar e mais respiro; compacto agrupa mensagens e libera mais espaço na tela."
      >
        <div className="px-4 py-2">
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Densidade das mensagens"
          >
            {(
              [
                ["cozy", "Aconchegante", "Avatar e mais espaço entre mensagens"],
                ["compact", "Compacto", "Mais mensagens visíveis por vez"],
              ] as const
            ).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={appearance.messageDensity === value}
                onClick={() => save({ messageDensity: value })}
                className={cn(
                  "min-h-20 rounded-lg border p-3 text-left transition-colors",
                  appearance.messageDensity === value
                    ? "border-[#5865F2] bg-[#5865F2]/20"
                    : "border-white/10 bg-[#1E1F22] hover:border-white/20"
                )}
              >
                <span className="block text-xs font-bold text-white">{label}</span>
                <span className="mt-1 block text-[10px] text-[#B5BAC1]">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </DiscordCard>

      <DiscordCard
        title="Escala da interface"
        description="A escala redimensiona a interface inteira; os dois sliders abaixo afetam apenas o texto do chat."
      >
        <div className="px-4 py-2">
          <div
            className="grid grid-cols-4 gap-2 sm:grid-cols-7"
            role="radiogroup"
            aria-label="Escala da interface"
          >
            {[75, 80, 90, 100, 110, 125, 150].map(value => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={appearance.uiScale === value}
                onClick={() => save({ uiScale: value })}
                className={cn(
                  "min-h-11 rounded-lg border px-2 text-[11px] font-bold transition-colors",
                  appearance.uiScale === value
                    ? "border-[#5865F2] bg-[#5865F2]/20 text-white"
                    : "border-white/10 bg-[#1E1F22] text-[#B5BAC1] hover:text-white"
                )}
              >
                {value}%
              </button>
            ))}
          </div>
        </div>
        <DiscordDivider />
        <DiscordSlider
          label="Tamanho do texto das mensagens"
          value={appearance.messageTextSize}
          min={12}
          max={24}
          step={1}
          formatValue={value => `${value}px`}
          onChange={value =>
            setAppearance(current => ({ ...current, messageTextSize: value }))
          }
          onCommit={value => save({ messageTextSize: value })}
        />
        <DiscordDivider />
        <DiscordSlider
          label="Espaçamento entre mensagens"
          value={appearance.messageSpacing}
          min={0}
          max={100}
          step={10}
          formatValue={value => `${value}%`}
          hints={["Compacto", "Espaçoso"]}
          onChange={value =>
            setAppearance(current => ({ ...current, messageSpacing: value }))
          }
          onCommit={value => save({ messageSpacing: value })}
        />
        <div className="rounded-lg bg-[#1E1F22] p-3" aria-label="Prévia da aparência">
          <div className="flex gap-3">
            <div
              className={cn(
                "size-9 shrink-0 rounded-full bg-gradient-to-br from-[#7383ff] to-[#4654d8]",
                appearance.messageDensity === "compact" && "hidden"
              )}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">Nexora</p>
              <p
                style={{ fontSize: appearance.messageTextSize }}
                className="mt-1 leading-relaxed text-bodyx"
              >
                Esta é uma prévia das suas mensagens.
              </p>
            </div>
          </div>
        </div>
      </DiscordCard>
    </div>
  );
}

const REDUCE_MOTION_KEY = "nexora-reduce-motion";

/** "Acessibilidade" — movimento e contraste. */
export function AccessibilityTab() {
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      return localStorage.getItem(REDUCE_MOTION_KEY) === "1";
    } catch {
      return false;
    }
  });
  const systemContrast = useSettingsStore(state => state.settings.systemContrast);
  const patch = useSettingsStore(state => state.patch);

  const toggleReduceMotion = (value: boolean) => {
    try {
      localStorage.setItem(REDUCE_MOTION_KEY, value ? "1" : "0");
    } catch {
      // Armazenamento indisponível: a preferência vale só para esta sessão.
    }
    document.documentElement.classList.toggle("reduce-motion", value);
    setReduceMotion(value);
  };

  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Acessibilidade"
        description="Preferências de navegação, movimento e contraste."
      />

      <DiscordCard>
        <DiscordToggle
          label="Reduzir animações"
          description="Desativa transições de interface para pessoas sensíveis a movimento (cinetose)."
          checked={reduceMotion}
          onCheckedChange={toggleReduceMotion}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Acompanhar contraste do sistema"
          description="Usa a preferência de alto contraste do sistema operacional."
          checked={systemContrast}
          onCheckedChange={value => patch({ systemContrast: value })}
        />
      </DiscordCard>

      <p className="text-[11px] leading-relaxed text-[#949BA4]">
        A Nexora também respeita automaticamente a preferência de "movimentação
        reduzida" declarada pelo seu sistema operacional.
      </p>
    </div>
  );
}
