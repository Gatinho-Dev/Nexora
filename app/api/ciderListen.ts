/**
 * "Ouvir junto" — a sessão de escuta compartilhada do Cider, do lado do servidor.
 *
 * É o mesmo desenho das salas de voz do `realtime.ts`: **estado em memória**, um
 * registro por sessão, sem uma linha de banco. Três razões para isso, e as três
 * importam:
 *
 * 1. uma sessão de escuta é a sala de voz de quem está no mesmo áudio — dura
 *    minutos, não é um objeto do produto que alguém volte a abrir depois;
 * 2. o banco é o de produção: uma funcionalidade social nova não precisa
 *    começar escrevendo nele para existir;
 * 3. o processo do realtime **é** a autoridade sobre quem está dentro — se o
 *    servidor reiniciar, os clientes caem junto, e não existe sessão fantasma
 *    para limpar (ninguém fica ouvindo sozinho um anfitrião que sumiu).
 *
 * Nada aqui fala com sockets: o registro decide o que vale e o `realtime.ts`
 * entrega. É o que torna possível testar as regras (código, lotação, entrada,
 * saída, sanitização do estado) sem subir WebSocket nenhum.
 */

import { randomUUID } from "node:crypto";

import { CIDER_LISTEN_EMOJIS, CiderListen } from "@contracts/constants";
import type {
  CiderListenMember,
  CiderListenRole,
  CiderListenState,
  CiderListenTrack,
} from "@contracts/types";

/** Identidade mínima de quem entra — vem do usuário da sessão autenticada. */
export interface ListenUser {
  userId: number;
  name: string;
  avatar?: string | null;
}

/**
 * Membro com o **segredo de retomada** — nunca sai daqui para outro cliente.
 *
 * Só o próprio dono recebe o seu token (no payload da sessão): é ele que
 * permite voltar para a mesma sessão depois de um recarregamento, sem que
 * ninguém possa se passar por outro membro para "retomar" a vaga dele.
 */
interface ListenMemberRecord {
  member: CiderListenMember;
  token: string;
}

export interface ListenSession {
  code: string;
  hostId: number;
  /** Quem está **presente** agora, na ordem de entrada. */
  members: Map<number, ListenMemberRecord>;
  /**
   * Quem já entrou alguma vez, com o token de cada um.
   *
   * É a diferença entre "saiu do socket" e "nunca esteve aqui": o assento fica
   * reservado, e é por ele que o convidado que recarregou a página (ou perdeu a
   * rede por um instante) volta para a própria vaga em vez de virar uma segunda
   * pessoa na lista. Os tokens **não** saem daqui na lista de participantes.
   */
  seats: Map<number, ListenMemberRecord>;
  /** Último estado publicado pelo anfitrião — o que um convidado recebe ao entrar. */
  state: CiderListenState | null;
  createdAt: number;
  /**
   * Quando o anfitrião ficou ausente (epoch ms) e `null` enquanto ele está aqui.
   *
   * É o que permite recarregar a página sem derrubar a sessão: o anfitrião sai
   * do socket, a sessão **espera** por ele por `CiderListen.HOST_GRACE_MS`, e os
   * convidados são avisados em vez de ficarem seguindo um player que não existe
   * mais. Passada a carência, a sessão acaba como sempre acabou.
   */
  hostAwayAt: number | null;
}

export interface ListenJoin {
  session: ListenSession;
  member: CiderListenMember;
  /** Token do próprio solicitante (retomada). */
  token: string;
}

export type ListenFail = { ok: false; reason: string };
export type ListenCreate = ({ ok: true } & ListenJoin) | ListenFail;
export type ListenEnter = ({ ok: true } & ListenJoin) | ListenFail;

/** `null` = não estava em sessão nenhuma. */
export interface ListenLeave {
  session: ListenSession | null;
  /** `true` quando a sessão inteira acabou. */
  ended: boolean;
  /**
   * `true` quando o anfitrião saiu mas a sessão **segue viva**, esperando ele
   * voltar dentro da janela de carência.
   */
  waiting: boolean;
}

function member(
  user: ListenUser,
  role: CiderListenRole
): CiderListenMember {
  return {
    userId: user.userId,
    name: user.name,
    avatar: user.avatar ?? null,
    role,
  };
}

/** Sessão que acabou de expirar, com quem ainda estava dentro. */
export interface ListenExpire {
  session: ListenSession;
  members: CiderListenMember[];
}

/**
 * Membros públicos da sessão, na ordem de entrada.
 *
 * É o formato que sai pela rede: os tokens de retomada ficam **dentro** do
 * registro e nunca acompanham a lista de participantes.
 */
export function listenMembers(session: ListenSession): CiderListenMember[] {
  return [...session.members.values()].map((record) => record.member);
}

/**
 * Uma sessão por usuário — a mesma regra das salas de voz.
 *
 * Quem está numa sessão e entra noutra sai da primeira (o `realtime.ts` avisa os
 * outros membros). Sem essa regra, o mesmo usuário apareceria em duas listas de
 * participantes e receberia dois estados para o mesmo player.
 */
export class ListenRegistry {
  private byCode = new Map<string, ListenSession>();
  private byUser = new Map<number, string>();
  private random: () => number;
  private token: () => string;
  private graceMs: number;

  constructor(
    random: () => number = Math.random,
    token: () => string = () => randomUUID(),
    graceMs: number = CiderListen.HOST_GRACE_MS
  ) {
    this.random = random;
    this.token = token;
    this.graceMs = graceMs;
  }

  /** A sessão em que o usuário está, seja como anfitrião ou convidado. */
  sessionOf(userId: number): ListenSession | null {
    const code = this.byUser.get(userId);
    return code ? (this.byCode.get(code) ?? null) : null;
  }

  codeOf(userId: number): string | null {
    return this.byUser.get(userId) ?? null;
  }

  members(code: string): CiderListenMember[] {
    const session = this.byCode.get(code);
    return session ? listenMembers(session) : [];
  }

  /** `true` enquanto o anfitrião está ausente dentro da janela de carência. */
  hostAway(code: string): boolean {
    return this.byCode.get(code)?.hostAwayAt != null;
  }

  /** Abre a sessão com `host` de anfitrião. */
  create(host: ListenUser, now = Date.now()): ListenCreate {
    if (this.byUser.has(host.userId)) {
      return { ok: false, reason: "Você já está numa sessão de escuta." };
    }
    const code = this.freshCode();
    if (!code) {
      return { ok: false, reason: "Não consegui gerar um código de sessão. Tente de novo." };
    }
    const hostMember = member(host, "host");
    const token = this.token();
    const hostRecord: ListenMemberRecord = { member: hostMember, token };
    const session: ListenSession = {
      code,
      hostId: host.userId,
      members: new Map([[host.userId, hostRecord]]),
      seats: new Map([[host.userId, hostRecord]]),
      state: null,
      createdAt: now,
      hostAwayAt: null,
    };
    this.byCode.set(code, session);
    this.byUser.set(host.userId, code);
    return { ok: true, session, member: hostMember, token };
  }

  /**
   * Entra numa sessão pelo código.
   *
   * As recusas são frases prontas porque quem as lê é a interface — e cada uma
   * responde a uma pergunta diferente que a pessoa pode estar se fazendo
   * ("digitei certo?", "já estou lá?", "cabe mais gente?").
   */
  join(rawCode: string, user: ListenUser): ListenEnter {
    const code = normalizeListenCode(rawCode);
    if (!code) {
      return { ok: false, reason: "Esse código não existe. Confira as letras e tente de novo." };
    }
    const session = this.byCode.get(code);
    if (!session) {
      return { ok: false, reason: "Essa sessão já terminou ou o código está errado." };
    }
    if (this.byUser.has(user.userId)) {
      return { ok: false, reason: "Você já está numa sessão de escuta." };
    }
    if (session.members.size >= CiderListen.MAX_MEMBERS) {
      return {
        ok: false,
        reason: `A sessão está cheia (${CiderListen.MAX_MEMBERS} pessoas).`,
      };
    }
    const guest = member(user, "guest");
    const token = this.token();
    const record: ListenMemberRecord = { member: guest, token };
    session.members.set(user.userId, record);
    session.seats.set(user.userId, record);
    this.byUser.set(user.userId, code);
    return { ok: true, session, member: guest, token };
  }

  /**
   * Volta para uma sessão já conhecida usando o **segredo de retomada**.
   *
   * É o caminho de quem recarregou a página ou perdeu a conexão por um instante.
   * O token diz quem a pessoa era — o servidor não precisa adivinhar pelo id,
   * e um membro não pode retomar a vaga de outro. O anfitrião que voltar dentro
   * da carência reaparece como anfitrião (a sessão nunca deixou de ser dele).
   */
  resume(code: string, rawToken: unknown, now = Date.now()): ListenEnter {
    const normalized = normalizeListenCode(code);
    if (!normalized) {
      return { ok: false, reason: "Esse código não existe. Confira as letras e tente de novo." };
    }
    const session = this.byCode.get(normalized);
    if (!session) {
      return { ok: false, reason: "Essa sessão já terminou." };
    }
    if (session.hostAwayAt != null && now - session.hostAwayAt >= this.graceMs) {
      this.closeSession(session);
      return { ok: false, reason: "Essa sessão já terminou." };
    }
    if (typeof rawToken !== "string" || !rawToken) {
      return { ok: false, reason: "Essa sessão já terminou." };
    }
    const record = [...session.seats.values()].find((entry) => entry.token === rawToken);
    if (!record) {
      return { ok: false, reason: "Essa sessão já terminou." };
    }
    // Reentra: a vaga pode ter ficado vazia (socket caiu) ou ainda existir.
    const userId = record.member.userId;
    session.members.set(userId, record);
    this.byUser.set(userId, session.code);
    if (userId === session.hostId) session.hostAwayAt = null;
    return { ok: true, session, member: record.member, token: record.token };
  }

  /**
   * Sai da sessão. O anfitrião **é** a sessão: quando ele sai, ela acaba.
   *
   * Não existe sessão sem anfitrião porque não existiria áudio para acompanhar —
   * manter os convidados numa sala vazia só os deixaria olhando uns para os
   * outros esperando alguém que não volta.
   */
  leave(userId: number, options: { keepHost?: boolean; now?: number } = {}): ListenLeave {
    const code = this.byUser.get(userId);
    if (!code) return { session: null, ended: false, waiting: false };
    const session = this.byCode.get(code);
    if (!session) {
      this.byUser.delete(userId);
      return { session: null, ended: false, waiting: false };
    }
    if (session.hostId === userId) {
      this.byUser.delete(userId);
      // Carência: o anfitrião que sumiu por alguns segundos volta para a mesma
      // sessão, e os convidados continuam aonde estavam. Só quem pediu para
      // sair de verdade (`keepHost` falso) encerra a sessão na hora.
      if (options.keepHost) {
        session.hostAwayAt = options.now ?? Date.now();
        return { session, ended: false, waiting: true };
      }
      this.closeSession(session);
      return { session, ended: true, waiting: false };
    }
    // O convidado sai da lista de presentes, mas o assento dele fica: é para
    // lá que ele volta se a queda foi de rede, e não uma escolha.
    session.members.delete(userId);
    this.byUser.delete(userId);
    return { session, ended: false, waiting: false };
  }

  /**
   * Fecha a sessão porque a carência do anfitrião acabou.
   *
   * Devolve quem estava dentro (para o realtime avisá-los) ou `null` quando não
   * havia nada para fechar — assim o temporizador da carência não avisa duas
   * vezes o mesmo fim de sessão.
   */
  expireHostAway(code: string, now = Date.now()): ListenExpire | null {
    const session = this.byCode.get(code);
    if (!session || session.hostAwayAt == null) return null;
    if (now - session.hostAwayAt < this.graceMs) return null;
    const members = listenMembers(session);
    this.closeSession(session);
    return { session, members };
  }

  private closeSession(session: ListenSession): void {
    for (const record of session.seats.values()) {
      this.byUser.delete(record.member.userId);
    }
    this.byCode.delete(session.code);
  }

  /** O anfitrião encerra a sessão para todos. */
  close(userId: number): ListenLeave {
    const session = this.sessionOf(userId);
    if (!session || session.hostId !== userId) {
      return { session: null, ended: false, waiting: false };
    }
    return this.leave(userId);
  }

  /**
   * Guarda o estado publicado. Só o anfitrião publica — um convidado que
   * mandasse estado reescreveria a fila de todos, que é exatamente o contrário
   * de ouvir junto.
   */
  setState(userId: number, state: CiderListenState): ListenSession | null {
    const session = this.sessionOf(userId);
    if (!session || session.hostId !== userId) return null;
    session.state = state;
    return session;
  }

  private freshCode(): string | null {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const code = makeListenCode(this.random);
      if (!this.byCode.has(code)) return code;
    }
    return null;
  }
}

/** Código novo, no alfabeto sem caracteres ambíguos. */
export function makeListenCode(random: () => number = Math.random): string {
  let code = "";
  for (let at = 0; at < CiderListen.CODE_LENGTH; at += 1) {
    code += CiderListen.CODE_ALPHABET[Math.floor(random() * CiderListen.CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Normaliza o que a pessoa digitou: maiúsculas, sem espaços nem hífens.
 *
 * É o mesmo tratamento do código de convite de grupo: quem lê um código em voz
 * alta não sabe onde estavam os espaços, e recusar `ab-cd ef` seria culpar o
 * usuário por uma diferença que a máquina resolve sozinha.
 */
export function normalizeListenCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/[\s-]/g, "").toUpperCase();
  if (value.length !== CiderListen.CODE_LENGTH) return null;
  for (const char of value) {
    if (!CiderListen.CODE_ALPHABET.includes(char)) return null;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number = CiderListen.MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Só `https` — a capa do convidado aponta para fora, e o host é sempre útil. */
function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

/**
 * Valida a faixa que o convidado vai reproduzir.
 *
 * `videoId` é o único campo obrigatório, e o formato é o do YouTube: entrar na
 * fila de outra pessoa é entrar no player dela, então nada além de um id de
 * vídeo pode chegar lá. Título e artista são texto de terceiros — entram
 * truncados.
 */
export function sanitizeListenTrack(raw: unknown): CiderListenTrack | null {
  if (!isRecord(raw)) return null;
  const videoId = typeof raw.videoId === "string" ? raw.videoId.trim() : "";
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return null;
  const title = text(raw.title);
  if (!title) return null;
  const duration = typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs)
    ? Math.max(0, Math.min(24 * 60 * 60_000, Math.round(raw.durationMs)))
    : 0;
  return {
    videoId,
    title,
    artist: text(raw.artist, 120),
    channelName: text(raw.channelName, 120),
    artworkUrl: httpsUrl(raw.artworkUrl),
    durationMs: duration,
    url: httpsUrl(raw.url),
  };
}

function position(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(24 * 60 * 60_000, Math.round(value)));
}

/**
 * Valida o estado do anfitrião — e **recusa** o que não fecha.
 *
 * A tentação seria "consertar" um estado torto, mas consertar aqui é pior:
 * o convidado seguiria uma fila que o anfitrião não tem. As duas coerências
 * exigidas são simples e verdadeiras:
 *
 * - a faixa que toca **está** na fila (o `index` aponta para um item de verdade);
 * - sem faixa, a fila está vazia (não existe \"tocando nada\" com coisas a seguir).
 */
export function sanitizeListenState(raw: unknown): CiderListenState | null {
  if (!isRecord(raw)) return null;

  const rawQueue = Array.isArray(raw.queue) ? raw.queue : [];
  const queue: CiderListenTrack[] = [];
  for (const item of rawQueue.slice(0, CiderListen.MAX_QUEUE)) {
    const track = sanitizeListenTrack(item);
    if (track) queue.push(track);
  }

  if (raw.track === null || raw.track === undefined) {
    if (queue.length > 0) return null;
    return { track: null, playing: false, positionMs: 0, index: -1, queue: [] };
  }

  const track = sanitizeListenTrack(raw.track);
  if (!track) return null;
  const index = queue.findIndex((item) => item.videoId === track.videoId);
  // A janela que o anfitrião publica começa na faixa atual (índice 0 no
  // cliente); aceitar um estado sem a faixa na fila abriria a porta para o
  // convidado mostrar \"a seguir\" uma lista que não tem o que está tocando.
  if (index < 0) return null;

  return {
    track,
    playing: raw.playing === true,
    positionMs: position(raw.positionMs),
    index,
    queue,
  };
}

/** Emoji da reação, ou `null` se não está na lista fechada. */
export function sanitizeListenEmoji(raw: unknown): string | null {
  return typeof raw === "string" && (CIDER_LISTEN_EMOJIS as readonly string[]).includes(raw)
    ? raw
    : null;
}

/** Pedido do convidado ao anfitrião, validado (o tipo do TS não vale em runtime). */
export function sanitizeListenRequest(
  raw: unknown
): { kind: "next" | "previous" | "toggle" | "seek"; positionMs?: number } | null {
  if (!isRecord(raw)) return null;
  const kind = raw.kind;
  if (kind === "next" || kind === "previous" || kind === "toggle") return { kind };
  if (kind === "seek") return { kind, positionMs: position(raw.positionMs) };
  return null;
}

export type InviteCheck =
  | "ok"
  | "self"
  | "not-friends"
  | "already-in-session"
  | "session-full";

/**
 * Quem pode ser convidado.
 *
 * Só amigo aceito: o convite **toca** na tela do outro (aviso com a sessão e o
 * nome de quem chamou), então aceitar desconhecidos transformaria o recurso num
 * canal de notificação para estranhos. \"Uma sessão por usuário\" e lotação são
 * as mesmas regras da entrada — melhor recusar no convite do que deixar a pessoa
 * clicar e receber um \"não\" depois.
 */
export function checkInvite(input: {
  fromUserId: number;
  toUserId: number;
  areFriends: boolean;
  targetInSession: boolean;
  memberCount: number;
}): InviteCheck {
  if (input.fromUserId === input.toUserId) return "self";
  if (!input.areFriends) return "not-friends";
  if (input.targetInSession) return "already-in-session";
  if (input.memberCount >= CiderListen.MAX_MEMBERS) return "session-full";
  return "ok";
}

/**
 * Intervalo mínimo por usuário (reações e publicações de estado).
 *
 * Um mapa de \"última vez\" e não um contador por janela: o que precisa ser
 * contido é a rajada (segurar o dedo no emoji), e uma janela deslizante de um
 * número só resolve isso sem manter histórico.
 */
export class ListenRateLimiter {
  private last = new Map<number, number>();
  private minMs: number;

  constructor(minMs: number) {
    this.minMs = minMs;
  }

  take(userId: number, now = Date.now()): boolean {
    const previous = this.last.get(userId) ?? 0;
    if (now - previous < this.minMs) return false;
    this.last.set(userId, now);
    return true;
  }

  forget(userId: number): void {
    this.last.delete(userId);
  }

  clear(): void {
    this.last.clear();
  }
}
