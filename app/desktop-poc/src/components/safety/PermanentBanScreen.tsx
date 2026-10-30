import { useNavigate } from "react-router";
import { NexoraAppIcon } from "../NexoraBrand";
import { Button } from "@/components/ui/button";

/**
 * Full-screen state for permanently banned accounts. The server enforces
 * the ban on every route — this screen is presentation only.
 */
export function PermanentBanScreen({ severeStrikes }: { severeStrikes: number }) {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-rail p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-sidebar p-8 text-center shadow-2xl">
        <span className="text-4xl" aria-hidden>🚫</span>
        <h1 className="mt-3 text-xl font-extrabold text-red-300">
          Sua conta foi banida
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-bodyx">
          Sua conta foi permanentemente suspensa do Nexora após atingir o
          limite de infrações graves.
        </p>

        <dl className="mt-5 space-y-1.5 rounded-xl bg-black/25 p-4 text-left text-xs">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-faint">Infrações graves:</dt>
            <dd className="font-bold">{severeStrikes} / 3</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-faint">Status:</dt>
            <dd className="font-bold text-red-300">Banimento permanente</dd>
          </div>
        </dl>

        <Button
          variant="ghost"
          onClick={() => navigate("/login")}
          className="mt-6 w-full text-xs text-muted2 hover:text-white"
        >
          Consultar Status da Conta
        </Button>
        <NexoraAppIcon decorative className="mx-auto mt-4 h-8 w-8 opacity-30" />
      </div>
    </main>
  );
}
