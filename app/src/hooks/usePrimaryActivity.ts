import type { RichPresenceActivityDTO } from "@contracts/types";
import { useAppStore } from "@/store/useAppStore";

export function usePrimaryActivity(
  userId: number | undefined,
  initialActivity: RichPresenceActivityDTO | null | undefined
) {
  const realtimeActivity = useAppStore(state =>
    userId ? state.richPresence[userId]?.[0] : undefined
  );
  return realtimeActivity ?? initialActivity ?? null;
}
