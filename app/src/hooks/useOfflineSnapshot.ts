import { useEffect, useState } from "react";
import { cacheSnapshot, loadSnapshot } from "@/lib/offlineCache";

export function useOfflineSnapshot<T>(
  key: string | null,
  liveValue: T | undefined,
) {
  const [cached, setCached] = useState<{ key: string; value: T | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!key || liveValue !== undefined) return () => { cancelled = true; };
    void loadSnapshot<T>(key).then(value => {
      if (!cancelled) setCached({ key, value });
    });
    return () => { cancelled = true; };
  }, [key, liveValue]);

  useEffect(() => {
    if (!key || liveValue === undefined) return;
    void cacheSnapshot(key, liveValue);
  }, [key, liveValue]);

  return {
    data: liveValue ?? (cached?.key === key ? cached.value ?? undefined : undefined),
    isCached: liveValue === undefined && cached?.key === key && cached.value !== null,
  };
}
