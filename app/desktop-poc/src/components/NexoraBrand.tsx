import appIcon from "../../assets/brand/nexora-app-icon.svg";
import logoDark from "../../assets/brand/nexora-logo-dark.svg";
import logoLight from "../../assets/brand/nexora-logo-light.svg";
import mark from "../../assets/brand/nexora-mark.svg";
import { cn } from "@/lib/utils";

type BrandImageProps = {
  className?: string;
  decorative?: boolean;
};

export function NexoraAppIcon({
  className,
  decorative = false,
}: BrandImageProps) {
  return (
    <img
      src={appIcon}
      alt={decorative ? "" : "Nexora"}
      aria-hidden={decorative || undefined}
      className={cn("block shrink-0 object-contain", className)}
    />
  );
}
export function NexoraMark({
  className,
  decorative = false,
}: BrandImageProps) {
  return (
    <img
      src={mark}
      alt={decorative ? "" : "Nexora"}
      aria-hidden={decorative || undefined}
      className={cn("block shrink-0 object-contain", className)}
    />
  );
}

export function NexoraLogo({
  className,
  surface = "dark",
  decorative = false,
}: BrandImageProps & { surface?: "dark" | "light" }) {
  return (
    <img
      src={surface === "dark" ? logoDark : logoLight}
      alt={decorative ? "" : "Nexora"}
      aria-hidden={decorative || undefined}
      className={cn("block shrink-0 object-contain", className)}
    />
  );
}
