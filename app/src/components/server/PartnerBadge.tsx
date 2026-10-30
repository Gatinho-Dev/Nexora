import { ServerBadge } from "@/components/server/ServerBadge";

export function PartnerBadge({
  className,
  withTooltip = true,
}: {
  className?: string;
  withTooltip?: boolean;
}) {
  return (
    <ServerBadge
      type="partner"
      className={className}
      withTooltip={withTooltip}
    />
  );
}
