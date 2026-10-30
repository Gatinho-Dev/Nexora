import type { MessageDTO } from "@contracts/types";

const DATABASE_NAME = "nexora-offline-v1";
const DATABASE_VERSION = 1;

export type OfflineMessage = {
  localId: string;
  channelId?: number;
  conversationId?: number;
  threadId?: number;
  replyToId?: number;
  content: string;
  createdAt: number;
  state: "pending" | "sending" | "failed";
  attempts: number;
  error?: string;
};

type CachedConversation = {
  key: string;
  messages: MessageDTO[];
  cachedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("conversations")) {
        db.createObjectStore("conversations", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const outbox = db.createObjectStore("outbox", { keyPath: "localId" });
        outbox.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  storeName: "conversations" | "outbox" | "snapshots",
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function cacheMessages(key: string, messages: MessageDTO[]) {
  if (!("indexedDB" in window)) return;
  const record: CachedConversation = {
    key,
    messages: messages.slice(-150),
    cachedAt: Date.now(),
  };
  await run("conversations", "readwrite", store => store.put(record)).catch(() => undefined);
}

export async function loadCachedMessages(key: string): Promise<MessageDTO[]> {
  if (!("indexedDB" in window)) return [];
  const record = await run<CachedConversation | undefined>("conversations", "readonly", store => store.get(key)).catch(() => undefined);
  return record?.messages ?? [];
}

export async function cacheSnapshot(key: string, value: unknown) {
  if (!("indexedDB" in window)) return;
  await run("snapshots", "readwrite", store => store.put({ key, value, cachedAt: Date.now() })).catch(() => undefined);
}

export async function loadSnapshot<T>(key: string): Promise<T | null> {
  if (!("indexedDB" in window)) return null;
  const record = await run<{ key: string; value: T } | undefined>("snapshots", "readonly", store => store.get(key)).catch(() => undefined);
  return record?.value ?? null;
}

export async function queueOfflineMessage(input: Omit<OfflineMessage, "localId" | "createdAt" | "state" | "attempts">) {
  const message: OfflineMessage = {
    ...input,
    localId: crypto.randomUUID(),
    createdAt: Date.now(),
    state: "pending",
    attempts: 0,
  };
  await run("outbox", "readwrite", store => store.put(message));
  dispatchOutboxChanged();
  return message;
}

export async function listOfflineMessages(): Promise<OfflineMessage[]> {
  if (!("indexedDB" in window)) return [];
  const items = await run<OfflineMessage[]>("outbox", "readonly", store => store.getAll()).catch(() => []);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateOfflineMessage(message: OfflineMessage) {
  await run("outbox", "readwrite", store => store.put(message));
  dispatchOutboxChanged();
}

export async function removeOfflineMessage(localId: string) {
  await run("outbox", "readwrite", store => store.delete(localId));
  dispatchOutboxChanged();
}

export function dispatchOutboxChanged() {
  window.dispatchEvent(new CustomEvent("nexora:outbox-changed"));
}
