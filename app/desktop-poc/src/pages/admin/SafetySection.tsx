import { useState } from "react";
import { Bot, Flag, Scale, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CasesSection } from "@/components/admin/CasesSection";
import { ViolationsQueueSection } from "@/components/admin/ViolationsQueueSection";
import { AppealsSection } from "@/components/admin/AppealsSection";
import { SafetyAiAuditSection } from "@/components/admin/SafetyAiAuditSection";

type SafetyTab = "cases" | "violations" | "appeals" | "ai";

const SUB_TABS: { id: SafetyTab; label: string; icon: typeof ShieldAlert }[] = [
  { id: "cases", label: "Casos", icon: Scale },
  { id: "violations", label: "Ocorrências", icon: Flag },
  { id: "appeals", label: "Apelações", icon: Bot },
  { id: "ai", label: "IA & Auditoria", icon: ShieldAlert },
];

/**
 * Administração → Segurança
 * Sub-tabs: Casos | Ocorrências | Apelações | IA & Auditoria.
 */
export function SafetySection() {
  const [tab, setTab] = useState<SafetyTab>("cases");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.055] bg-[#191b20] p-1.5">
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:flex-none",
                tab === t.id
                  ? "bg-[#5865F2] text-white"
                  : "text-[#9da4ae] hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "cases" && <CasesSection />}
      {tab === "violations" && <ViolationsQueueSection />}
      {tab === "appeals" && <AppealsSection />}
      {tab === "ai" && <SafetyAiAuditSection />}
    </div>
  );
}
