/**
 * "Ouvir junto" no navegador: a store da sessão, a ponte com o WebSocket e a
 * ponte com o motor.
 *
 * Três decisões que valem explicação:
 *
 * 1. **Quem publica é o motor do anfitrião.** A assinatura do estado ignora o
 *    progresso fino, então o que sai pela rede é "mudou algo que os outros
 *    precisam saber" — não um relógio. E quando o estado muda antes de o
 *    intervalo mínimo passar, a publicação é **agendada**, não descartada.
 * 2. **O convidado não comanda o próprio player.** Pular, voltar, pausar e
 *    buscar posição viram pedidos ao anfitrião; o estado dele volta como
 *    verdade. Dois controles independentes para a mesma fila fariam a sessão
 *    andar para lados diferentes — que é o oposto de ouvir junto.
 * 3. **A sessão vale para o aplicativo inteiro**, e não só para `/cider`: o
 *    motor vive acima do roteador e o mini-player continua tocando fora da rota.
 *    Se a sessão só existisse dentro da página do Cider, ela pararia de seguir
 *    no instante em que a pessoa voltasse para a Nexora.
 */

import { create } from "zustand";

import { CiderListen } from "@contracts/constants";
import type {
  CiderListenMember,
  CiderListenRequestKind,
  CiderListenState,
  WSServerEvent,
} from "@contracts/types";
import { realtime } from "@/lib/ws";
import type { CiderEngine } from "./engine";
import type { CiderTrack } from "./api/query";
import { ciderToast } from "./ui";
import {
  followPlan,
  listenStateFrom,
  listenStateSignature,
  makeReaction,
  pruneReactions,
  publishPlan,
  readListenCode,
  trackFromListen,
  type FloatingReaction,
} from "./core/listen";

export interface ListenSessionView {
  code: string;
  hostId: number;
  /** O próprio membro, como o servidor o vê: é o que diz o papel nesta sessão. */
  me: CiderListenMember;
  members: CiderListenMember[];
  /** Último estado do anfitrião (só o convidado guarda). */
  sync: CiderListenState | null;
  /** Quando esse estado chegou, no relógio local. */
  receivedAt: number;
}

export interface ListenInvite {
  code: string;
  fromName: string;
  at: number;
}

interface ListenStore {
  session: ListenSessionView | null;
  invite: ListenInvite | null;
  reactions: FloatingReaction[];
  /** Última negativa do servidor, para o painel explicar o que aconteceu. */
  error: string | null;
  /**
   * Segura a aplicação do estado remoto enquanto uma prévia de 30 s está aberta.
   *
   * Sem isto, o batimento da sessão (a cada cinco segundos) retomaria o áudio do
   * convidado no meio da prévia, e os dois sons se sobreporiam — que é
   * exatamente o acidente que a prévia do "Adicionar músicas à fila" evita.
   */
  hold: boolean;

  reset: () => void;
  setSession: (session: ListenSessionView) => void;
  setMembers: (members: CiderListenMember[]) => void;
  setSync: (state: CiderListenState) => void;
  setInvite: (invite: ListenInvite | null) => void;
  setError: (error: string | null) => void;
  setHold: (hold: boolean) => void;
  pushReaction: (reaction: FloatingReaction) => void;
  pruneReactions: (now: number) => void;
}

export const useCiderListen = create<ListenStore>((set) => ({
  session: null,
  invite: null,
  reactions: [],
  error: null,
  hold: false,

  reset: () =>
    set({ session: null, invite: null, reactions: [], error: null, hold: false }),
  setSession: (session) => set({ session, error: null }),
  setMembers: (members) =>
    set((store) => (store.session ? { session: { ...store.session, members } } : {})),
  setSync: (sync) =>
    set((store) =>
      store.session ? { session: { ...store.session, sync, receivedAt: Date.now() } } : {},
    ),
  setInvite: (invite) => set({ invite }),
  setError: (error) => set({ error }),
  setHold: (hold) => set({ hold }),
  pushReaction: (reaction) =>
    set((store) => ({
      reactions: pruneReactions([...store.reactions, reaction], reaction.at),
    })),
  pruneReactions: (now) =>
    set((store) => ({ reactions: pruneReactions(store.reactions, now) })),
}));

/* ------------------------------------------------------------------ *
 * Ponte com o motor                                                  *
 * ------------------------------------------------------------------ */

let engine: CiderEngine | null = null;
let lastSignature: string | null = null;
let lastPublishedAt = 0;
let publishTimer: ReturnType<typeof setTimeout> | null = null;

function isHost(): boolean {
  return useCiderListen.getState().session?.me.role === "host";
}

/**
 * Publica o estado, respeitando o intervalo mínimo e **agendando** o que ficou
 * para depois — uma troca de faixa não pode ser engolida pelo relógio.
 */
function publishTick(now: number): void {
  if (!engine || !isHost()) return;
  const snapshot = engine.snapshot();
  const state = listenStateFrom({
    track: snapshot.track,
    queue: snapshot.queue,
    index: snapshot.index,
    positionMs: snapshot.positionMs,
    playing: snapshot.phase === "playing",
  });
  const signature = listenStateSignature(state);
  const plan = publishPlan(lastSignature, signature, lastPublishedAt, now);
  if (plan === "none") return;
  if (plan === "now") {
    lastSignature = signature;
    lastPublishedAt = now;
    realtime.send({ t: "cider:listen:state", state });
    return;
  }
  if (publishTimer) return;
  publishTimer = setTimeout(() => {
    publishTimer = null;
    publishTick(Date.now());
  }, Math.max(0, CiderListen.STATE_INTERVAL_MS - (now - lastPublishedAt)));
}

/**
 * Aplica o estado do anfitrião ao player do convidado.
 *
 * A ordem importa: carregar a fila, corrigir a posição e só então acertar o
 * play/pause — buscar posição num vídeo que ainda não é o certo moveria o
 * vídeo errado.
 */
function applyFollow(): void {
  const store = useCiderListen.getState();
  const session = store.session;
  if (!engine || !session || session.me.role !== "guest" || !session.sync || store.hold) return;

  const snapshot = engine.snapshot();
  const plan = followPlan(
    {
      videoId: snapshot.track?.videoId ?? null,
      index: snapshot.index,
      queueIds: snapshot.queue.map((track) => track.videoId),
      positionMs: snapshot.positionMs,
      playing: snapshot.phase === "playing",
    },
    session.sync,
    session.receivedAt,
  );
  if (plan.aligned) return;

  if (plan.load) {
    if (!session.sync.track) {
      engine.clearQueue();
    } else {
      engine.followQueue(
        session.sync.queue.map(trackFromListen),
        session.sync.index,
        plan.positionMs,
        plan.playing,
      );
    }
  } else if (plan.seek) {
    engine.seekMs(plan.positionMs);
  }

  const playing = engine.snapshot().phase === "playing";
  if (plan.playing !== playing) {
    if (plan.playing) engine.resume();
    else engine.pause();
  }
}

const REQUEST_LABEL: Record<CiderListenRequestKind, string> = {
  next: "pulou a faixa",
  previous: "voltou uma faixa",
  toggle: "mexeu no play",
  seek: "buscou outra posição",
};

/** O anfitrião faz o que o convidado pediu — o pedido nunca vira comando direto. */
function applyRequest(
  kind: CiderListenRequestKind,
  positionMs: number | undefined,
  name: string,
): void {
  if (!engine) return;
  switch (kind) {
    case "next":
      engine.next();
      break;
    case "previous":
      engine.previous();
      break;
    case "toggle":
      engine.toggle();
      break;
    case "seek":
      if (typeof positionMs === "number") engine.seekMs(positionMs);
      break;
  }
  // Buscar posição pode acontecer muitas vezes num arrasto só; avisar cada uma
  // encheria a tela de avisos por um gesto que é um só.
  if (kind !== "seek") {
    ciderToast("info", `${name} ${REQUEST_LABEL[kind]}`, "Todos continuam na mesma faixa.");
  }
  publishTick(Date.now());
}

/* ------------------------------------------------------------------ *
 * Eventos do servidor                                                *
 * ------------------------------------------------------------------ */

function handleListenEvent(event: WSServerEvent): void {
  const store = useCiderListen.getState();

  switch (event.t) {
    case "cider:listen:session": {
      lastSignature = null;
      lastPublishedAt = 0;
      store.setSession({
        code: event.code,
        hostId: event.hostId,
        me: event.me,
        members: event.members,
        sync: event.state,
        receivedAt: Date.now(),
      });
      if (event.me.role === "host") {
        ciderToast(
          "success",
          "Sessão de escuta aberta",
          `Código ${event.code}. Quem entrar ouve o que você está ouvindo.`,
        );
        publishTick(Date.now());
      } else {
        const host = event.members.find((member) => member.userId === event.hostId);
        ciderToast(
          "success",
          `Ouvindo junto com ${host?.name ?? "o anfitrião"}`,
          "O que toca aqui é o que toca na sessão.",
        );
        applyFollow();
      }
      break;
    }

    case "cider:listen:members": {
      const before = store.session?.members ?? [];
      const added = event.members.filter(
        (member) => !before.some((known) => known.userId === member.userId),
      );
      const removed = before.filter(
        (member) => !event.members.some((known) => known.userId === member.userId),
      );
      store.setMembers(event.members);
      for (const member of added) {
        if (member.userId === store.session?.me.userId) continue;
        ciderToast("info", `${member.name} entrou na sessão`);
      }
      for (const member of removed) {
        if (member.userId === store.session?.me.userId) continue;
        ciderToast("info", `${member.name} saiu da sessão`);
      }
      break;
    }

    case "cider:listen:sync": {
      if (store.session?.me.role !== "guest") return;
      store.setSync(event.state);
      applyFollow();
      break;
    }

    case "cider:listen:reaction": {
      if (!store.session) return;
      store.pushReaction(makeReaction({ emoji: event.emoji, name: event.name, at: Date.now() }));
      break;
    }

    case "cider:listen:request": {
      if (!isHost()) return;
      applyRequest(event.kind, event.positionMs, event.name);
      break;
    }

    case "cider:listen:add": {
      if (!engine || !isHost()) return;
      engine.appendQueue([trackFromListen(event.track)]);
      ciderToast("info", `${event.name} sugeriu uma faixa`, event.track.title);
      publishTick(Date.now());
      break;
    }

    case "cider:listen:ended": {
      const hostName = store.session?.members.find(
        (member) => member.userId === store.session?.hostId,
      )?.name;
      store.reset();
      ciderToast(
        "info",
        "A sessão de escuta terminou",
        event.reason === "host-left"
          ? `${hostName ?? "O anfitrião"} saiu — cada um voltou a ouvir por conta.`
          : "O anfitrião encerrou a sessão.",
      );
      break;
    }

    case "cider:listen:invited": {
      store.setInvite({ code: event.code, fromName: event.from.name, at: Date.now() });
      ciderToast("info", `${event.from.name} está ouvindo junto`, "Quer entrar na sessão?", {
        actionLabel: "Entrar",
        action: () => joinListen(event.code),
        timeoutMs: 15_000,
      });
      break;
    }

    case "cider:listen:denied": {
      store.setError(event.reason);
      ciderToast("warning", "A sessão de escuta não abriu", event.reason);
      break;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Ações                                                              *
 * ------------------------------------------------------------------ */

/** Envia já, ou espera a conexão abrir — `/cider` pode ser um link direto. */
function sendWhenConnected(event: Parameters<typeof realtime.send>[0]): void {
  realtime.connect();
  if (realtime.send(event)) return;
  void realtime
    .waitUntilConnected()
    .then(() => {
      if (!realtime.send(event)) {
        ciderToast("error", "Sem conexão com a Nexora", "Não deu para falar com a sessão de escuta.");
      }
    })
    .catch(() => {
      ciderToast("error", "Sem conexão com a Nexora", "Não deu para falar com a sessão de escuta.");
    });
}

export function startListen(): void {
  sendWhenConnected({ t: "cider:listen:start" });
}

export function joinListen(rawCode: string): void {
  const code = readListenCode(rawCode);
  if (!code) {
    useCiderListen.getState().setError("Esse código não existe. Confira as letras e tente de novo.");
    return;
  }
  sendWhenConnected({ t: "cider:listen:join", code });
}

export function leaveListen(): void {
  realtime.send({ t: "cider:listen:leave" });
  useCiderListen.getState().reset();
}

export function endListen(): void {
  realtime.send({ t: "cider:listen:end" });
  useCiderListen.getState().reset();
  ciderToast("info", "Sessão encerrada", "Quem estava ouvindo junto voltou para a própria fila.");
}

export function inviteToListen(userId: number): void {
  realtime.send({ t: "cider:listen:invite", toUserId: userId });
}

/** Um convidado sugere faixas: quem escolhe o lugar delas é o anfitrião. */
export function suggestToListen(tracks: CiderTrack[]): number {
  const session = useCiderListen.getState().session;
  if (!session || session.me.role !== "guest") return 0;
  const usable = tracks.filter((track) => track.videoId).slice(0, 10);
  for (const track of usable) {
    realtime.send({
      t: "cider:listen:add",
      track: {
        videoId: track.videoId,
        title: track.title,
        artist: track.artist || null,
        channelName: track.channelName || null,
        artworkUrl: track.artworkUrl || null,
        durationMs: track.durationMs || 0,
        url: track.url || null,
      },
    });
  }
  return usable.length;
}

let lastRequestAt = 0;
let lastReactAt = 0;

/** Pedidos do convidado ao anfitrião, com a mesma trava da reação. */
export function requestFromListen(
  kind: CiderListenRequestKind,
  positionMs?: number,
): boolean {
  const session = useCiderListen.getState().session;
  if (!session || session.me.role !== "guest") return false;
  if (kind === "seek") {
    const now = Date.now();
    if (now - lastRequestAt < 400) return false;
    lastRequestAt = now;
  }
  realtime.send({ t: "cider:listen:request", kind, positionMs });
  return true;
}

export function reactToListen(emoji: string): void {
  const store = useCiderListen.getState();
  const session = store.session;
  if (!session) return;
  // O eco local e o envio andam juntos: a reação aparece na hora para quem
  // reagiu (o servidor entrega aos outros) — e a trava vale para os dois, para
  // a tela de quem reagiu não mostrar o que ninguém mais viu.
  const now = Date.now();
  if (now - lastReactAt < CiderListen.REACT_INTERVAL_MS) return;
  lastReactAt = now;
  store.pushReaction(makeReaction({ emoji, name: session.me.name, at: now }));
  realtime.send({ t: "cider:listen:react", emoji });
}

/* ------------------------------------------------------------------ *
 * Ponte (montada pelo provider)                                      *
 * ------------------------------------------------------------------ */

/**
 * Liga o realtime e o motor à store, e devolve como desligar tudo.
 *
 * A ponte é montada no `CiderProvider`, acima do roteador, pelo mesmo motivo do
 * motor: a sessão precisa continuar valendo quando a pessoa sai de `/cider`.
 */
export function attachListenEngine(motor: CiderEngine): () => void {
  engine = motor;
  const offEvents = realtime.on(handleListenEvent);
  const offConnect = realtime.onConnect((connected) => {
    // A sessão vive no processo do realtime e enquanto o socket vive: se a
    // conexão caiu, o servidor já tirou este usuário da sala. Dizer isso é
    // melhor do que continuar mostrando uma sessão que não existe mais.
    if (!connected && useCiderListen.getState().session) {
      useCiderListen.getState().reset();
      ciderToast("warning", "A sessão de escuta terminou", "A conexão caiu — entre de novo pelo painel.");
    }
  });
  const offEngine = motor.subscribe(() => publishTick(Date.now()));
  return () => {
    offEvents();
    offConnect();
    offEngine();
    if (publishTimer) {
      clearTimeout(publishTimer);
      publishTimer = null;
    }
    if (engine === motor) engine = null;
  };
}

/** Tira da tela as reações que já viveram o bastante. */
export function pruneListenReactions(now = Date.now()): void {
  useCiderListen.getState().pruneReactions(now);
}
