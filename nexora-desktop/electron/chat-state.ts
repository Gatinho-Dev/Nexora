export type MessageRecord = { id: number };

/** Preserve older pages and apply concurrent edits/deletions over a stale snapshot. */
export function reconcileMessages<T extends MessageRecord>(
  current: T[], incoming: T[], mode: "older" | "latest", touched: ReadonlySet<number>,
): T[] {
  const first = incoming[0]?.id;
  const retained = mode === "older"
    ? current
    : first === undefined ? current.filter(message => touched.has(message.id))
      : current.filter(message => message.id < first || touched.has(message.id));
  const combined = new Map<number, T>();
  for (const message of retained) combined.set(message.id, message);
  for (const message of incoming) {
    if (!touched.has(message.id) && (mode !== "older" || !combined.has(message.id))) combined.set(message.id, message);
  }
  return [...combined.values()].sort((a, b) => a.id - b.id);
}
