/**
 * Regras da sessão de escuta compartilhada ("Ouvir junto").
 *
 * O registro inteiro é em memória e não fala com socket nenhum — é o que
 * permite exercitar aqui o que a interface só mostraria ao vivo: código,
 * lotação, entrada, saída, anfitrião que sai, e a sanitização do estado que o
 * convidado vai seguir. Nada de banco, nada de WebSocket.
 */

import { describe, expect, it } from "vitest";

import { CIDER_LISTEN_EMOJIS, CiderListen } from "@contracts/constants";
import {
  checkInvite,
  ListenRateLimiter,
  ListenRegistry,
  makeListenCode,
  normalizeListenCode,
  sanitizeListenEmoji,
  sanitizeListenRequest,
  sanitizeListenState,
  sanitizeListenTrack,
} from "./ciderListen";

const user = (id: number, name = `Pessoa ${id}`) => ({ userId: id, name });

/** Gerador determinístico: sempre o primeiro caractere do alfabeto. */
const firstChar = () => 0;

function stateOf(videoId: string, extra: Record<string, unknown> = {}) {
  const track = { videoId, title: `Faixa ${videoId}` };
  return { track, playing: true, positionMs: 1000, index: 0, queue: [track], ...extra };
}

describe("código da sessão", () => {
  it("gera um código do alfabeto sem caracteres ambíguos", () => {
    const code = makeListenCode(firstChar);
    expect(code).toHaveLength(CiderListen.CODE_LENGTH);
    expect(code).toBe("A".repeat(CiderListen.CODE_LENGTH));
    expect(CiderListen.CODE_ALPHABET).not.toMatch(/[0OI1L]/);
  });

  it("usou o gerador em cada caractere (não repete um sorteio só)", () => {
    let calls = 0;
    makeListenCode(() => {
      calls += 1;
      return 0.5;
    });
    expect(calls).toBe(CiderListen.CODE_LENGTH);
  });

  it("aceita o que a pessoa digitou com espaço, hífen e minúsculas", () => {
    expect(normalizeListenCode("ab-cd ef")).toBe("ABCDEF");
  });

  it("recusa tamanho errado, caractere fora do alfabeto e o que não é texto", () => {
    expect(normalizeListenCode("ABC")).toBeNull();
    expect(normalizeListenCode("ABCDE0")).toBeNull();
    expect(normalizeListenCode(null)).toBeNull();
  });
});

describe("entrada e saída da sessão", () => {
  it("quem abre é o anfitrião, e a sessão guarda o código", () => {
    const registry = new ListenRegistry(firstChar);
    const created = registry.create(user(1, "Ana"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.member.role).toBe("host");
    expect(created.session.hostId).toBe(1);
    expect(created.session.code).toBe("AAAAAA");
    expect(registry.members("AAAAAA")).toHaveLength(1);
  });

  it("convidado entra pelo código e aparece na lista depois do anfitrião", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    const joined = registry.join("aaaaaa", user(2, "Bia"));
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    expect(joined.member.role).toBe("guest");
    expect(registry.members("AAAAAA").map((m) => m.userId)).toEqual([1, 2]);
    expect(registry.sessionOf(2)?.code).toBe("AAAAAA");
  });

  it("código desconhecido e código torto têm respostas diferentes", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    const missing = registry.join("BBBBBB", user(2));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toContain("terminou");
    const malformed = registry.join("nada", user(2));
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.reason).toContain("não existe");
  });

  it("um usuário por sessão: quem já está dentro não entra de novo", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    const again = registry.join("AAAAAA", user(1));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toContain("já está");
  });

  it("a sessão recusa o participante a mais do teto", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    for (let id = 2; id <= CiderListen.MAX_MEMBERS; id += 1) {
      expect(registry.join("AAAAAA", user(id)).ok).toBe(true);
    }
    const overflow = registry.join("AAAAAA", user(CiderListen.MAX_MEMBERS + 1));
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.reason).toContain("cheia");
  });

  it("convidado que sai não encerra a sessão", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    registry.join("AAAAAA", user(2));
    const left = registry.leave(2);
    expect(left.ended).toBe(false);
    expect(left.session?.code).toBe("AAAAAA");
    expect(registry.members("AAAAAA").map((m) => m.userId)).toEqual([1]);
    expect(registry.sessionOf(2)).toBeNull();
  });

  it("o anfitrião que sai encerra a sessão para todos", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    registry.join("AAAAAA", user(2));
    const left = registry.leave(1);
    expect(left.ended).toBe(true);
    expect(registry.sessionOf(2)).toBeNull();
    const rejoin = registry.join("AAAAAA", user(2));
    expect(rejoin.ok).toBe(false);
  });

  it("só o anfitrião encerra a sessão", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    registry.join("AAAAAA", user(2));
    expect(registry.close(2).ended).toBe(false);
    expect(registry.sessionOf(1)?.code).toBe("AAAAAA");
  });

  it("sair sem estar em sessão não inventa nada", () => {
    const registry = new ListenRegistry(firstChar);
    expect(registry.leave(99)).toEqual({ session: null, ended: false, waiting: false });
  });
});

describe("retomada e carência do anfitrião", () => {
  /** Token previsível: o que importa é ser único e estável por membro. */
  function tokens() {
    let count = 0;
    return () => `tok-${(count += 1)}`;
  }

  function session(graceMs = 120_000) {
    const registry = new ListenRegistry(firstChar, tokens(), graceMs);
    const created = registry.create(user(1, "Ana"));
    if (!created.ok) throw new Error("a sessão não abriu");
    const joined = registry.join("AAAAAA", user(2, "Bia"));
    if (!joined.ok) throw new Error("a convidada não entrou");
    return { registry, host: created.token, guest: joined.token };
  }

  it("cada membro recebe um segredo só dele", () => {
    const { host, guest } = session();
    expect(host).toBeTruthy();
    expect(guest).toBeTruthy();
    expect(host).not.toBe(guest);
  });

  it("queda de conexão do anfitrião deixa a sessão esperando, não a encerra", () => {
    const { registry } = session();
    const left = registry.leave(1, { keepHost: true, now: 5_000 });
    expect(left).toMatchObject({ ended: false, waiting: true });
    expect(registry.hostAway("AAAAAA")).toBe(true);
    // Os convidados continuam na sala, e o anfitrião segue na lista (é para onde
    // ele volta).
    expect(registry.members("AAAAAA").map((m) => m.userId)).toEqual([1, 2]);
    expect(registry.sessionOf(2)?.code).toBe("AAAAAA");
  });

  it("quem saiu de verdade encerra a sessão na hora", () => {
    const { registry } = session();
    expect(registry.leave(1)).toMatchObject({ ended: true, waiting: false });
    expect(registry.sessionOf(2)).toBeNull();
  });

  it("o anfitrião volta com o token e retoma o comando", () => {
    const { registry, host } = session();
    registry.leave(1, { keepHost: true, now: 1_000 });
    const resumed = registry.resume("AAAAAA", host, 2_000);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.member.role).toBe("host");
    expect(resumed.session.hostAwayAt).toBeNull();
    expect(registry.hostAway("AAAAAA")).toBe(false);
    // O anfitrião volta a estar "dentro": a sessão é dele de novo.
    expect(registry.codeOf(1)).toBe("AAAAAA");
    expect(registry.codeOf(2)).toBe("AAAAAA");
  });

  it("o convidado volta com o token e recupera a própria vaga", () => {
    const { registry, guest } = session();
    registry.leave(2);
    expect(registry.members("AAAAAA").map((m) => m.userId)).toEqual([1]);
    const resumed = registry.resume("AAAAAA", guest, 3_000);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.member.userId).toBe(2);
    expect(resumed.member.role).toBe("guest");
    expect(registry.members("AAAAAA").map((m) => m.userId)).toEqual([1, 2]);
  });

  it("token desconhecido ou de sessão que já acabou não retoma nada", () => {
    const { registry, host } = session();
    expect(registry.resume("AAAAAA", "palpite").ok).toBe(false);
    expect(registry.resume("AAAAAA", null).ok).toBe(false);
    expect(registry.resume("BBBBBB", host).ok).toBe(false);
    expect(registry.resume("AAAAAA", host).ok).toBe(true);
  });

  it("acabou a carência, a sessão fecha e devolve quem ficou", () => {
    const { registry, host } = session(1_000);
    registry.leave(1, { keepHost: true, now: 10_000 });
    expect(registry.expireHostAway("AAAAAA", 10_500)).toBeNull();
    const expired = registry.expireHostAway("AAAAAA", 11_000);
    expect(expired?.members.map((m) => m.userId)).toEqual([1, 2]);
    expect(registry.sessionOf(2)).toBeNull();
    expect(registry.codeOf(2)).toBeNull();
    // O token não ressuscita uma sessão encerrada.
    expect(registry.resume("AAAAAA", host, 11_500).ok).toBe(false);
  });

  it("retomar depois da carência também encerra, em vez de aceitar a volta", () => {
    const { registry, host } = session(1_000);
    registry.leave(1, { keepHost: true, now: 10_000 });
    const late = registry.resume("AAAAAA", host, 12_000);
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.reason).toContain("terminou");
    expect(registry.sessionOf(2)).toBeNull();
  });
});

describe("estado publicado pelo anfitrião", () => {
  it("só o anfitrião publica — convidado não reescreve a fila de todos", () => {
    const registry = new ListenRegistry(firstChar);
    registry.create(user(1));
    registry.join("AAAAAA", user(2));
    expect(registry.setState(2, sanitizeListenState(stateOf("abcdefghij"))!)).toBeNull();
    expect(registry.setState(1, sanitizeListenState(stateOf("abcdefghij"))!)).not.toBeNull();
    expect(registry.sessionOf(2)?.state?.track?.videoId).toBe("abcdefghij");
  });

  it("aceita a janela de fila e mantém o índice da faixa que toca", () => {
    const queue = ["aaaaaaaaaa", "bbbbbbbbbb", "cccccccccc"].map((id) => ({
      videoId: id,
      title: id,
    }));
    const parsed = sanitizeListenState({
      track: queue[1],
      playing: true,
      positionMs: 12_000,
      index: 1,
      queue,
    });
    expect(parsed?.index).toBe(1);
    expect(parsed?.queue).toHaveLength(3);
  });

  it("recusa estado em que a faixa não está na fila", () => {
    expect(
      sanitizeListenState({
        track: { videoId: "aaaaaaaaaa", title: "Fora" },
        playing: true,
        positionMs: 0,
        index: 0,
        queue: [{ videoId: "bbbbbbbbbb", title: "Dentro" }],
      })
    ).toBeNull();
  });

  it("recusa fila sem faixa: 'nada tocando' não tem coisas a seguir", () => {
    expect(
      sanitizeListenState({ track: null, playing: true, positionMs: 10, index: 0, queue: [] })
    ).toMatchObject({ track: null, playing: false, positionMs: 0, index: -1 });
    expect(
      sanitizeListenState({
        track: null,
        queue: [{ videoId: "aaaaaaaaaa", title: "Na fila" }],
      })
    ).toBeNull();
  });

  it("corta a fila no teto e limita a posição a um dia", () => {
    const queue = Array.from({ length: CiderListen.MAX_QUEUE + 10 }, (_item, at) => ({
      videoId: `vid${String(at).padStart(7, "0")}`,
      title: `Faixa ${at}`,
    }));
    const parsed = sanitizeListenState({
      track: queue[0],
      playing: true,
      positionMs: 99 * 60 * 60_000,
      index: 0,
      queue,
    });
    expect(parsed?.queue).toHaveLength(CiderListen.MAX_QUEUE);
    expect(parsed?.positionMs).toBe(24 * 60 * 60_000);
  });
});

describe("faixa e reação", () => {
  it("a faixa precisa de id de vídeo utilizável", () => {
    expect(sanitizeListenTrack({ videoId: "curto", title: "X" })).toBeNull();
    expect(sanitizeListenTrack({ videoId: "dQw4w9WgXcQ" })).toBeNull(); // sem título
    expect(sanitizeListenTrack({ videoId: "dQw4w9WgXcQ", title: "Título" })?.videoId).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("capa e link só entram por https, e o texto é truncado", () => {
    const track = sanitizeListenTrack({
      videoId: "dQw4w9WgXcQ",
      title: "T".repeat(500),
      artworkUrl: "http://exemplo.com/capa.jpg",
      url: "javascript:alert(1)",
    });
    expect(track?.title).toHaveLength(CiderListen.MAX_TEXT);
    expect(track?.artworkUrl).toBeNull();
    expect(track?.url).toBeNull();
  });

  it("reação só da lista fechada", () => {
    expect(sanitizeListenEmoji(CIDER_LISTEN_EMOJIS[0])).toBe(CIDER_LISTEN_EMOJIS[0]);
    expect(sanitizeListenEmoji("💀")).toBeNull();
    expect(sanitizeListenEmoji(7)).toBeNull();
  });

  it("pedido do convidado é validado antes de virar ação", () => {
    expect(sanitizeListenRequest({ kind: "next" })).toEqual({ kind: "next" });
    expect(sanitizeListenRequest({ kind: "seek", positionMs: 5_000 })).toEqual({
      kind: "seek",
      positionMs: 5_000,
    });
    expect(sanitizeListenRequest({ kind: "explodir" })).toBeNull();
    expect(sanitizeListenRequest(null)).toBeNull();
  });
});

describe("convite", () => {
  const base = { fromUserId: 1, toUserId: 2, areFriends: true, targetInSession: false, memberCount: 2 };

  it("amigo aceito, sessão com vaga: convite passa", () => {
    expect(checkInvite(base)).toBe("ok");
  });

  it("recusa convite para si, para quem não é amigo e para quem já está numa sessão", () => {
    expect(checkInvite({ ...base, toUserId: 1 })).toBe("self");
    expect(checkInvite({ ...base, areFriends: false })).toBe("not-friends");
    expect(checkInvite({ ...base, targetInSession: true })).toBe("already-in-session");
    expect(checkInvite({ ...base, memberCount: CiderListen.MAX_MEMBERS })).toBe("session-full");
  });
});

describe("limite de frequência", () => {
  it("deixa passar a primeira e segura a rajada", () => {
    const limiter = new ListenRateLimiter(600);
    expect(limiter.take(1, 10_000)).toBe(true);
    expect(limiter.take(1, 10_200)).toBe(false);
    expect(limiter.take(1, 10_600)).toBe(true);
  });

  it("o limite é por usuário", () => {
    const limiter = new ListenRateLimiter(600);
    limiter.take(1, 1_000);
    expect(limiter.take(2, 1_100)).toBe(true);
    limiter.forget(1);
    expect(limiter.take(1, 1_200)).toBe(true);
  });
});
