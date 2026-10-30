import { useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/hooks/useAuth";
import { AccountStanding } from "@/components/safety/AccountStanding";
import { ReportsList } from "@/components/safety/ReportsList";
import { AppealsSection } from "@/components/safety/AppealsSection";
import { DiscordCard, DiscordPageHeader } from "@/components/settings/DiscordSettings";

/** "Status da Conta" — avisos, punições e histórico de violações. */
export function StandingTab() {
  const { user } = useAuth();
  const safety = trpc.safety.me.useQuery();
  const setSensitiveMediaPref = useAppStore(s => s.setSensitiveMediaPref);

  useEffect(() => {
    if (safety.data) {
      setSensitiveMediaPref(safety.data.safety.sensitiveMediaPref);
    }
  }, [safety.data, setSensitiveMediaPref]);

  if (!user || safety.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted2">
        Carregando status da conta...
      </div>
    );
  }
  if (!safety.data) return null;

  return (
    <AccountStanding
      user={{
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar ?? null,
      }}
      safety={safety.data.safety}
      violations={safety.data.violations}
    />
  );
}

/** "Minhas Denúncias" — acompanhamento do que você reportou. */
export function MyReportsTab() {
  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Minhas Denúncias"
        description="Acompanhe o andamento das denúncias enviadas para a equipe de segurança."
      />
      <ReportsList />
    </div>
  );
}

/** "Apelações" — pedidos de revisão de decisões. */
export function AppealsTab() {
  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Apelações"
        description="Discorda de uma decisão? Solicite revisão em Status da Conta e acompanhe o resultado aqui."
      />
      <AppealsSection />
    </div>
  );
}

const SENSITIVE_OPTIONS: {
  value: "hide" | "warn" | "auto";
  label: string;
  desc: string;
}[] = [
  {
    value: "hide",
    label: "Sempre ocultar",
    desc: "Mídia sensível nunca é revelada por você.",
  },
  {
    value: "warn",
    label: "Mostrar com aviso",
    desc: "Mídia +18 aparece borrada até você clicar em mostrar.",
  },
  {
    value: "auto",
    label: "Mostrar automaticamente",
    desc: "Disponível apenas para contas elegíveis.",
  },
];

/** "Conteúdo Sensível" — como a Nexora exibe mídia verificada. */
export function SensitiveContentTab() {
  const utils = trpc.useUtils();
  const safety = trpc.safety.me.useQuery();
  const setPref = trpc.safety.setSensitiveMediaPref.useMutation({
    onSuccess: () => void utils.safety.me.invalidate(),
    onError: error => toast.error(error.message),
  });
  const storePref = useAppStore(s => s.sensitiveMediaPref);
  const setStorePref = useAppStore(s => s.setSensitiveMediaPref);

  const current = safety.data?.safety.sensitiveMediaPref ?? storePref;

  return (
    <div className="space-y-5">
      <DiscordPageHeader
        title="Conteúdo Sensível"
        description="Controla como a Nexora exibe mídias marcadas como sensíveis pela verificação automática de segurança."
      />
      <DiscordCard>
        <div className="space-y-2 px-4 py-2" role="radiogroup" aria-label="Conteúdo sensível">
          {SENSITIVE_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors " +
                (current === opt.value
                  ? "border-[#5865F2]/60 bg-[#5865F2]/[0.08]"
                  : "border-white/10 hover:bg-white/[0.04]") +
                (opt.value === "auto" ? " cursor-not-allowed opacity-60" : "")
              }
            >
              <input
                type="radio"
                name="sensitive-pref"
                className="mt-0.5 accent-[#5865F2]"
                checked={current === opt.value}
                disabled={opt.value === "auto"}
                onChange={() => {
                  setStorePref(opt.value);
                  setPref.mutate({ pref: opt.value });
                }}
              />
              <span>
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-faint">{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </DiscordCard>
      <p className="text-[11px] text-faint">
        A opção automática exige verificação de idade na sua conta.
      </p>
    </div>
  );
}
