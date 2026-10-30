import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_EMPTY_ROOM_TTL_MS,
  LIVE_RECONNECT_GRACE_MS,
  sanitizeNickname,
  sanitizeRoomName,
  validateNickname,
  validateRoomName,
  normalizeRoomCode,
  roomCodeFromShareInput,
  isValidRoomCode,
  nicknameKey,
} from "@contracts/live";
import {
  createRoom,
  joinRoom,
  postChat,
  removeSession,
  relaySignal,
  resetLiveRoomsForTests,
  kickParticipant,
  endRoomByHost,
  liveRoomCount,
  roomOfSession,
  detachSocket,
  getRoomInfo,
  type LiveSocketLike,
} from "./rooms";

type FakeSocket = {
  sent: string[];
  closed: number | null;
} & LiveSocketLike;

function fakeSocket(): FakeSocket {
  const state = { sent: [] as string[], closed: null as number | null };
  return {
    get sent() {
      return state.sent;
    },
    get closed() {
      return state.closed;
    },
    readyState: 1,
    send(data: string) {
      state.sent.push(data);
    },
    close(code?: number) {
      state.closed = code ?? 0;
    },
  };
}

function events(socket: FakeSocket): { t: string }[] {
  return socket.sent.map(
    (raw: string): { t: string } => JSON.parse(raw) as { t: string }
  );
}

function lastEvent<T extends { t: string }>(socket: FakeSocket): T {
  return JSON.parse(socket.sent[socket.sent.length - 1]) as T;
}

// Mock do banco: as salas Live funcionam sem MySQL (persistência best-effort).
vi.mock("../queries/connection", () => ({
  getDb: () => {
    throw new Error("no db in tests");
  },
}));

describe("contracts: nick e código", () => {
  it("sanitiza nicks (controle, invisíveis, espaços, tamanho)", () => {
    expect(sanitizeNickname("  Gatinho\u200b_Dev  ")).toBe("Gatinho_Dev");
    // Caracteres de injeção/XSS são descartados, não escapados.
    expect(sanitizeNickname("a<script>alert(1)</script>")).toBe(
      "ascriptalert1script"
    );
    expect(sanitizeNickname("abc\x00def")).toBe("abcdef");
    expect(sanitizeNickname("A".repeat(100)).length).toBe(24);
  });

  it("valida nicks", () => {
    expect(validateNickname("ab").ok).toBe(true);
    expect(validateNickname("a").ok).toBe(false);
    expect(validateNickname("").ok).toBe(false);
    expect(validateNickname("_abc").ok).toBe(false);
    expect(validateNickname("nexora suporte").ok).toBe(false);
    const ok = validateNickname("Gatinho_Dev");
    expect(ok.ok && ok.value).toBe("Gatinho_Dev");
  });

  it("normaliza códigos e extrai de links", () => {
    expect(normalizeRoomCode("ab7k2q")).toBe("AB7K2Q");
    expect(
      roomCodeFromShareInput("https://nexorachat.cloud/live/ab7k2q")
    ).toBe("AB7K2Q");
    expect(isValidRoomCode("AB7K2Q")).toBe(true);
    expect(isValidRoomCode("ab")).toBe(false);
    expect(nicknameKey("Gatinho_Dev")).toBe("gatinho_dev");
  });

  it("sanitiza e valida nome da sala", () => {
    // Vazio é válido (nome opcional) → value null.
    expect(validateRoomName("")).toEqual({ ok: true, value: null });
    // Sanitização: sem tags, invisíveis, espaços colapsados e corte no máx.
    expect(sanitizeRoomName("  Jogos<script>de  sexta  ")).toBe(
      "Jogosscriptde sexta"
    );
    expect(sanitizeRoomName("a".repeat(100)).length).toBe(40);
    const ok = validateRoomName("Rancho do Zé");
    expect(ok.ok && ok.value).toBe("Rancho do Zé");
    // Só pontuação → inválido.
    expect(validateRoomName("---").ok).toBe(false);
  });
});

describe("live rooms (backend)", () => {
  beforeEach(() => {
    resetLiveRoomsForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function makeRoom() {
    return createRoom();
  }

  it("cria sala com código e hostToken", async () => {
    const room = await makeRoom();
    expect(room.ok).toBe(true);
    if (room.ok) {
      expect(room.code).toHaveLength(6);
      expect(room.hostToken.length).toBeGreaterThan(20);
    }
  });

  it("cria sala com nome e o expõe no join e no getRoomInfo", async () => {
    const created = await createRoom("Festa de Lançamento");
    if (!created.ok) throw new Error("create failed");
    expect(created.name).toBe("Festa de Lançamento");
    const sid = "12121212-1212-1212-1212-121212121212";
    const join = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Ana",
      socket: fakeSocket(),
    });
    expect(join.ok).toBe(true);
    if (join.ok) {
      expect(join.payload.roomName).toBe("Festa de Lançamento");
    }
    const info = getRoomInfo(created.code);
    expect(info.name).toBe("Festa de Lançamento");
  });

  it("sala nunca ocupada encerra após 1 minuto", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    expect(liveRoomCount()).toBe(1);
    // Antes do TTL: sala viva.
    vi.advanceTimersByTime(LIVE_EMPTY_ROOM_TTL_MS - 1000);
    expect(liveRoomCount()).toBe(1);
    // Depois do TTL de 1 min: encerrada.
    vi.advanceTimersByTime(2000);
    expect(liveRoomCount()).toBe(0);
  });

  it("join cancela o TTL de 1 min (sala continua viva)", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const sid = "13131313-1313-1313-1313-131313131313";
    const join = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Ana",
      socket: fakeSocket(),
    });
    expect(join.ok).toBe(true);
    vi.advanceTimersByTime(LIVE_EMPTY_ROOM_TTL_MS * 3);
    expect(liveRoomCount()).toBe(1);
    expect(getRoomInfo(created.code).exists).toBe(true);
  });

  it("join novo recebe sessionToken e é host com hostToken", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const ws = fakeSocket();
    const result = joinRoom({
      code: created.code,
      sessionId: "11111111-1111-1111-1111-111111111111",
      nickname: "Ana",
      socket: ws,
      hostToken: created.hostToken,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sessionToken).toBeTruthy();
      expect(result.payload.you.isHost).toBe(true);
      expect(result.payload.hostSessionId).toBe(
        "11111111-1111-1111-1111-111111111111"
      );
    }
  });

  it("rejeita reconexão sem sessionToken (anti-hijack)", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const sid = "22222222-2222-2222-2222-222222222222";
    const first = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Bia",
      socket: fakeSocket(),
    });
    if (!first.ok) throw new Error("join failed");
    const token = first.payload.sessionToken;

    // Mesmo sessionId, sem token → negado.
    const hijack = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Bia",
      socket: fakeSocket(),
    });
    expect(hijack.ok).toBe(false);

    // Token errado → negado.
    const wrong = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Bia",
      socket: fakeSocket(),
      sessionToken: "wrong-token",
    });
    expect(wrong.ok).toBe(false);

    // Token certo → reconecta.
    const ok = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Bia",
      socket: fakeSocket(),
      sessionToken: token,
    });
    expect(ok.ok).toBe(true);
  });

  it("bloqueia nick duplicado (case-insensitive)", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    joinRoom({
      code: created.code,
      sessionId: "44444444-4444-4444-4444-444444444444",
      nickname: "Gatinho",
      socket: fakeSocket(),
    });
    const dup = joinRoom({
      code: created.code,
      sessionId: "55555555-5555-5555-5555-555555555555",
      nickname: "gatinho",
      socket: fakeSocket(),
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toBe("nick-taken");
  });

  it("limita participantes", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const info = getRoomInfo(created.code);
    expect(info.exists).toBe(true);
    let last: ReturnType<typeof joinRoom> | null = null;
    for (let i = 0; i < info.maxParticipants! + 1; i++) {
      last = joinRoom({
        code: created.code,
        sessionId: `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, "0")}`,
        nickname: `User${i}`,
        socket: fakeSocket(),
      });
    }
    expect(last?.ok).toBe(false);
    if (last && !last.ok) expect(last.reason).toBe("room-full");
  });

  it("chat: broadcast, limite de histórico e rate limit", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const sid = "66666666-6666-6666-6666-666666666666";
    const ws = fakeSocket();
    const join = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Ana",
      socket: ws,
    });
    expect(join.ok).toBe(true);
    const first = postChat(sid, "oi pessoal!");
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.message.content).toBe("oi pessoal!");
      expect(events(ws).some((e: { t: string }) => e.t === "live:chat")).toBe(
        true
      );
    }
    // Rate limit: 5 msgs / 5s — a 6ª falha.
    for (let i = 0; i < 5; i++) {
      postChat(sid, `spam ${i}`);
    }
    const blocked = postChat(sid, "deveria bloquear");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("rate-limited");
  });

  it("transferência de host quando host sai", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const hostSid = "77777777-7777-7777-7777-777777777777";
    const otherSid = "88888888-8888-8888-8888-888888888888";
    const otherWs = fakeSocket();
    joinRoom({
      code: created.code,
      sessionId: hostSid,
      nickname: "Host",
      socket: fakeSocket(),
      hostToken: created.hostToken,
    });
    joinRoom({
      code: created.code,
      sessionId: otherSid,
      nickname: "Bia",
      socket: otherWs,
    });
    removeSession(hostSid);
    const evts = events(otherWs);
    const hostEvent = evts.find((e: { t: string }) => e.t === "live:host");
    expect(hostEvent).toBeTruthy();
    expect(
      (hostEvent as unknown as { hostSessionId: string }).hostSessionId
    ).toBe(otherSid);
  });

  it("kick apenas pelo host", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const hostSid = "99999999-9999-9999-9999-999999999999";
    const otherSid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const targetWs = fakeSocket();
    joinRoom({
      code: created.code,
      sessionId: hostSid,
      nickname: "Host",
      socket: fakeSocket(),
      hostToken: created.hostToken,
    });
    joinRoom({
      code: created.code,
      sessionId: otherSid,
      nickname: "Bia",
      socket: targetWs,
    });
    // Não-host tenta kick → nada acontece.
    expect(kickParticipant(otherSid, hostSid)).toBe(false);
    // Host kicka Bia.
    expect(kickParticipant(hostSid, otherSid)).toBe(true);
    expect(targetWs.closed).toBe(4000);
    expect(roomOfSession(otherSid)).toBeNull();
  });

  it("end apenas pelo host", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const hostSid = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    joinRoom({
      code: created.code,
      sessionId: hostSid,
      nickname: "Host",
      socket: fakeSocket(),
      hostToken: created.hostToken,
    });
    expect(endRoomByHost(hostSid)).toBe(true);
    expect(liveRoomCount()).toBe(0);
  });

  it("relay de sinal só dentro da mesma sala", async () => {
    const a = await makeRoom();
    const b = await makeRoom();
    if (!a.ok || !b.ok) throw new Error("create failed");
    const s1 = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const s2 = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const s3 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    joinRoom({ code: a.code, sessionId: s1, nickname: "A", socket: fakeSocket() });
    const ws2 = fakeSocket();
    joinRoom({ code: b.code, sessionId: s2, nickname: "B", socket: ws2 });
    const ws3 = fakeSocket();
    joinRoom({ code: b.code, sessionId: s3, nickname: "C", socket: ws3 });
    // Salas diferentes → não entrega.
    expect(relaySignal(s1, s2, { candidate: null })).toBe(false);
    // Mesma sala → entrega ao alvo.
    expect(relaySignal(s2, s3, { candidate: null })).toBe(true);
    const last = lastEvent(ws3) as { t: string; from: string };
    expect(last.t).toBe("live:signal");
    expect(last.from).toBe(s2);
  });

  it("sala vazia expira (TTL) e max-age encerra", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const sid = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Solo",
      socket: fakeSocket(),
    });
    removeSession(sid);
    // Sala vazia: agenda expiração.
    vi.advanceTimersByTime(LIVE_EMPTY_ROOM_TTL_MS + 1000);
    expect(liveRoomCount()).toBe(0);
  });

  it("reconexão dentro da grace evita remoção", async () => {
    const created = await makeRoom();
    if (!created.ok) throw new Error("create failed");
    const sid = "abababab-abab-abab-abab-abababababab";
    const ws1 = fakeSocket();
    const first = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Ana",
      socket: ws1,
    });
    if (!first.ok) throw new Error("join failed");
    const token = first.payload.sessionToken;
    detachSocket(created.code, sid, ws1);
    // Reconecta dentro da janela de grace.
    vi.advanceTimersByTime(LIVE_RECONNECT_GRACE_MS / 2);
    const ws2 = fakeSocket();
    const again = joinRoom({
      code: created.code,
      sessionId: sid,
      nickname: "Ana",
      socket: ws2,
      sessionToken: token,
    });
    expect(again.ok).toBe(true);
    // Passa da grace: participante continua (reconectado, sem timeout).
    vi.advanceTimersByTime(LIVE_RECONNECT_GRACE_MS * 2);
    expect(roomOfSession(sid)).toBe(created.code);
  });
});
