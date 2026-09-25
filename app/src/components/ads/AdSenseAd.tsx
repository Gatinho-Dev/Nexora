import { useEffect } from "react";
import { ADSENSE_PUBLISHER_ID, ensureAdSenseScript } from "@/lib/adsense";
import { cn } from "@/lib/utils";

type AdSenseAdProps = {
  /** Slot fornecido futuramente pelo painel do Google AdSense. */
  slot: string;
  format?: "auto" | "rectangle" | "fluid";
  responsive?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
  label?: string;
};

type AdSenseWindow = Window & {
  adsbygoogle?: unknown[];
};

/**
 * Infraestrutura de anúncios preparada para uso futuro. Nenhuma tela atual
 * instancia este componente, evitando anúncios em login, chat, Live, voz,
 * configurações e painel administrativo.
 */
export function AdSenseAd({
  slot,
  format = "auto",
  responsive = true,
  width,
  height,
  className,
  label = "Publicidade",
}: AdSenseAdProps) {
  useEffect(() => {
    if (!import.meta.env.PROD || !slot.trim()) return;
    ensureAdSenseScript();
    const adsWindow = window as AdSenseWindow;
    if (!Array.isArray(adsWindow.adsbygoogle)) {
      adsWindow.adsbygoogle = [];
    }
    adsWindow.adsbygoogle.push({});
  }, [slot]);

  if (!slot.trim()) return null;

  return (
    <ins
      className={cn("block", className)}
      aria-label={label}
      data-ad-client={ADSENSE_PUBLISHER_ID}
      data-ad-slot={slot.trim()}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : undefined}
      style={{
        display: "block",
        width: width ?? (responsive ? "100%" : undefined),
        height,
      }}
    />
  );
}
