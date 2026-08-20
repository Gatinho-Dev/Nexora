// End-to-end realtime test: fresh users each run (idempotent)
import WebSocket from "ws";
import { randomBytes } from "crypto";

const B = "http://localhost:3000";
const suffix = randomBytes(3).toString("hex");
const UA = `ana_${suffix}`;
const UB = `bruno_${suffix}`;

async function trpc(cookie, path, input, method = "POST") {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const url = `${B}/api/trpc/${path}`;
  const res =
    method === "POST"
      ? await fetch(url, { method, headers, body: JSON.stringify({ json: input }) })
      : await fetch(`${url}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`, { headers });
  const data = await res.json();
  if (data.error) throw new Error(`${path}: ${JSON.stringify(data.error).slice(0, 200)}`);
  return data.result.data.json;
}

async function register(username, displayName) {
  const res = await fetch(`${B}/api/trpc/account.register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { username, displayName, password: "senha123" } }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`register: ${JSON.stringify(data.error)}`);
  const setCookie = res.headers.get("set-cookie");
  return setCookie.split(";")[0]; // kimi_sid=...
}

function connect(cookie, label, log) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://localhost:3000/ws", { headers: { Cookie: cookie } });
    ws.on("message", (raw) => {
      const ev = JSON.parse(raw.toString());
      if (ev.t === "ready") return resolve(ws);
      log.push(ev);
    });
    ws.on("error", reject);
    setTimeout(() => reject(new Error("ws timeout")), 5000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok) {
  results.push([name, ok]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

// ── Setup ─────────────────────────────────────────────────────
const cookieA = await register(UA, "Ana");
const cookieB = await register(UB, "Bruno");
check("register A/B", !!cookieA && !!cookieB);

const { server } = await trpc(cookieA, "server.create", { name: `Servidor ${suffix}` });
const details = await trpc(cookieA, "server.get", { serverId: server.id }, "GET");
const textCh = details.channels.find((c) => c.type === "TEXT");
const voiceCh = details.channels.find((c) => c.type === "VOICE");
check("default channels created", !!textCh && !!voiceCh);
check("default roles created", details.roles.length === 3 && details.roles.some((r) => r.isDefault));

const { code } = await trpc(cookieA, "server.createInvite", { serverId: server.id });
await trpc(cookieB, "server.joinByCode", { code });
const bServers = await trpc(cookieB, "server.list", undefined, "GET");
check("B joined via invite", bServers.some((s) => s.id === server.id));

const anaEvents = [];
const brunoEvents = [];
const wsA = await connect(cookieA, "ana", anaEvents);
const wsB = await connect(cookieB, "bruno", brunoEvents);
check("WS connect A/B", true);

// ── Chat realtime ─────────────────────────────────────────────
const { message: sent } = await trpc(cookieA, "message.send", {
  channelId: textCh.id,
  content: `olá @${UB}!`,
});
await sleep(1200);
check("B received message:new", brunoEvents.some((e) => e.t === "message:new" && e.message.id === sent.id));
check("B mention notification", brunoEvents.some((e) => e.t === "notification" && e.notification.type === "mention"));

wsA.send(JSON.stringify({ t: "typing", channelId: textCh.id }));
await sleep(800);
check("B received typing", brunoEvents.some((e) => e.t === "typing" && e.user.username === UA));

await trpc(cookieA, "message.edit", { messageId: sent.id, content: "editada!" });
await sleep(1000);
check("B received message:update", brunoEvents.some((e) => e.t === "message:update" && e.message.editedAt));

await trpc(cookieB, "message.addReaction", { messageId: sent.id, emoji: "👍" });
await sleep(1000);
check("A received reaction", anaEvents.some((e) => e.t === "reaction" && e.reactions.some((r) => r.emoji === "👍")));

// Reply
const { message: reply } = await trpc(cookieB, "message.send", {
  channelId: textCh.id,
  content: "respondendo!",
  replyToId: sent.id,
});
await sleep(1000);
check("A received reply + notification", anaEvents.some((e) => e.t === "message:new" && e.message.id === reply.id && e.message.replyTo?.id === sent.id));

// ── Presence ──────────────────────────────────────────────────
wsA.send(JSON.stringify({ t: "presence", status: "dnd" }));
await sleep(1000);
check("B sees A as dnd", brunoEvents.some((e) => e.t === "presence" && e.status === "dnd"));
wsA.send(JSON.stringify({ t: "presence", status: "online" }));

// ── Friends + DM ──────────────────────────────────────────────
await trpc(cookieB, "friend.sendRequest", { username: UA });
await sleep(800);
const anaFriends = await trpc(cookieA, "friend.list", undefined, "GET");
const incoming = anaFriends.find((f) => f.status === "PENDING" && f.direction === "incoming");
check("A sees incoming request", !!incoming);
check("A got friend_request notification", anaEvents.some((e) => e.t === "notification" && e.notification.type === "friend_request"));
await trpc(cookieA, "friend.accept", { friendshipId: incoming.friendshipId });
const brunoFriends = await trpc(cookieB, "friend.list", undefined, "GET");
check("B sees accepted friend", brunoFriends.some((f) => f.status === "ACCEPTED"));

const { conversationId } = await trpc(cookieB, "dm.open", { userId: sent.authorId });
await trpc(cookieB, "message.send", { conversationId, content: "oi, DM!" });
await sleep(1200);
check("A received DM realtime", anaEvents.some((e) => e.t === "message:new" && e.message.conversationId === conversationId));
const anaConvs = await trpc(cookieA, "dm.list", undefined, "GET");
check("A lists DM with unread", anaConvs.some((c) => c.id === conversationId && c.unreadCount >= 1));

// ── Voice + signaling ─────────────────────────────────────────
wsA.send(JSON.stringify({ t: "voice:join", channelId: voiceCh.id }));
await sleep(1000);
wsB.send(JSON.stringify({ t: "voice:join", channelId: voiceCh.id }));
await sleep(2500);
check(
  "A sees 2 voice participants",
  anaEvents.some((e) => e.t === "voice:participants" && e.participants.length === 2),
);
const brunoId = anaFriends[0].user.id;
wsA.send(JSON.stringify({ t: "signal", to: brunoId, channelId: voiceCh.id, data: { kind: "offer", sdp: "x" } }));
await sleep(800);
check("B received signal", brunoEvents.some((e) => e.t === "signal" && e.data.kind === "offer"));
wsB.send(JSON.stringify({ t: "voice:state", muted: true }));
await sleep(1500);
check(
  "A sees B muted",
  anaEvents.some((e) => e.t === "voice:participants" && e.participants.find((p) => p.name === "Bruno")?.muted === true),
);

// ── Permissions ───────────────────────────────────────────────
let denied = false;
try {
  await trpc(cookieB, "server.createChannel", { serverId: server.id, name: "hack", type: "TEXT" });
} catch {
  denied = true;
}
check("member cannot create channel", denied);

denied = false;
try {
  await trpc(cookieB, "message.delete", { messageId: sent.id });
} catch {
  denied = true;
}
check("member cannot delete others' message", denied);

await trpc(cookieA, "message.delete", { messageId: sent.id });
await sleep(1000);
check("B received message:delete", brunoEvents.some((e) => e.t === "message:delete" && e.id === sent.id));

// ── Rate limit (parallel burst) ───────────────────────────────
const burst = await Promise.allSettled(
  Array.from({ length: 8 }, (_, i) =>
    trpc(cookieB, "message.send", { channelId: textCh.id, content: `burst ${i}` }),
  ),
);
check(
  "burst of 8 is rate-limited",
  burst.some((r) => r.status === "rejected" && /TOO_MANY_REQUESTS|rápido demais/.test(r.reason.message)),
);

// ── Upload ────────────────────────────────────────────────────
const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082", "hex");
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "pixel.png");
const upRes = await fetch(`${B}/api/upload`, { method: "POST", headers: { Cookie: cookieA }, body: form });
const uploaded = await upRes.json();
check("upload png", upRes.ok && uploaded.id > 0);
const fileRes = await fetch(`${B}/api/files/${uploaded.id}`, { headers: { Cookie: cookieB } });
check("download file (member)", fileRes.ok && (await fileRes.arrayBuffer()).byteLength === png.length);
const noAuthRes = await fetch(`${B}/api/files/${uploaded.id}`);
check("file requires auth", noAuthRes.status === 401);

// message with attachment
await trpc(cookieA, "message.send", { channelId: textCh.id, content: "com anexo", attachmentIds: [uploaded.id] });
await sleep(1200);
check(
  "B received message with attachment",
  brunoEvents.some((e) => e.t === "message:new" && e.message.attachments.length === 1 && e.message.attachments[0].url.includes("/api/files/")),
);

// ── Unread (B received A's last message after B's last read) ──
const unread = await trpc(cookieB, "message.unread", undefined, "GET");
check("B has unread count", (unread.channels[textCh.id] ?? 0) >= 1);

wsA.close();
wsB.close();
await sleep(300);
const failed = results.filter(([, ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
