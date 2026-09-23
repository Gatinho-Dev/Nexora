/**
 * Teste E2E do Nexora CLI contra a API local — tudo em um processo Node
 * (a API sobe embutida, sem depender de servidor sobreviver entre comandos).
 *
 * Valida: device flow completo (start → approve → poll), auth via Bearer,
 * tRPC (auth.me, dm.list), WebSocket realtime (/ws) e broadcast de mensagem.
 */
process.env.PORT = "3210"; // porta fixa — dotenvx do boot reinjeta .env e zeraria o valor

const assert = (cond, name) => {
  if (!cond) throw new Error("FALHOU: " + name);
  console.log("✓", name);
};

const { getDb } = await import("../api/queries/connection.ts");
const schema = await import("../db/schema.ts");
const { eq } = await import("drizzle-orm");
const { signSessionToken } = await import("../api/auth/token.ts");
const { createSession } = await import("../api/auth/sessions.ts");
const { nanoid } = await import("nanoid");

// ── Usuário real do banco ────────────────────────────────────
const db = getDb();
const [user] = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.id, db.$with ? 1 : 1))
  .limit(1)
  .catch(() => [null]);
const rows = user
  ? [user]
  : await db.select().from(schema.users).limit(1);
assert(rows.length > 0, "banco acessível e com usuários");
const owner = rows[0];

// Sessão real para o dono (simula o cookie do Web)
const ownerSid = nanoid(24);
const ownerToken = await signSessionToken({
  unionId: owner.unionId,
  clientId: "nexora",
  sid: ownerSid,
});
await createSession({
  userId: owner.id,
  sid: ownerSid,
  token: ownerToken,
  userAgent: "E2E-Web/1.0",
});

// ── Sobe a API embutida ──────────────────────────────────────
const { serve } = await import("@hono/node-server");
const app = (await import("../api/boot.ts")).default;
const base = `http://127.0.0.1:${process.env.PORT}`;
const server = serve({ fetch: app.fetch, port: Number(process.env.PORT), hostname: "127.0.0.1" });
// Mesma fiação do api/server.ts: anexa o gateway de realtime ao http.Server
const { attachRealtime } = await import("../api/realtime.ts");
attachRealtime(server);
// Espera a API responder (boot conecta banco, anexa WS, etc.)
let apiUp = false;
let lastProbeErr = null;
for (let i = 0; i < 40 && !apiUp; i++) {
  await new Promise(r => setTimeout(r, 500));
  apiUp = await fetch(`${base}/api/cli/device/start`, { method: "POST" })
    .then(r => r.ok)
    .catch(e => { lastProbeErr = String(e && e.cause?.code || e.message || e); return false; });
}
if (!apiUp) console.error("probe erro:", lastProbeErr);
assert(apiUp, "API embutida respondeu");

// ── 1. Device flow ───────────────────────────────────────────
const startRes = await fetch(`${base}/api/cli/device/start`, { method: "POST" });
assert(startRes.ok, "device/start responde");
const start = await startRes.json();
assert(start.deviceCode && start.userCode && start.verifyUrl, "start emite deviceCode+userCode+verifyUrl");

// Página /cli/login só existe com o SPA montado (produção/Vite). Aqui
// validamos apenas quando o build existe; a rota em si é verificada por
// grep em api/lib/vite.ts (SPA_ROUTES).
const { existsSync } = await import("node:fs");
if (existsSync("../dist/public")) {
  const loginPage = await fetch(`${base}/cli/login`);
  assert(loginPage.ok, "rota /cli/login acessível (página de autorização)");
} else {
  console.log("- /cli/login pulado (sem build dist/public no teste embutido)");
}

// Aprovação com o cookie do Web
const approveRes = await fetch(`${base}/api/cli/device/approve`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: `${"nexora_sid"}=${ownerToken}` },
  body: JSON.stringify({ userCode: start.userCode }),
});
assert(approveRes.ok, "device/approve aceita cookie de sessão do Web");
const approved = await approveRes.json();
assert(approved.ok !== false, "aprovação confirmada");

// CLI faz polling e recebe o token
const pollRes = await fetch(`${base}/api/cli/device/poll`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ deviceCode: start.deviceCode }),
});
assert(pollRes.ok, "device/poll responde");
const poll = await pollRes.json();
assert(poll.accessToken && typeof poll.accessToken === "string" && poll.accessToken.length > 20, "poll entrega token de sessão ao CLI");
const cliToken = poll.accessToken;

// Token do CLI deve funcionar como o do Web
const meRes = await fetch(`${base}/api/trpc/auth.me?batch=1&input=` + encodeURIComponent(JSON.stringify({ "0": { json: null, meta: { values: [] } } })), {
  headers: { authorization: `Bearer ${cliToken}` },
});
assert(meRes.ok, "auth.me aceita Bearer do CLI");
const me = await meRes.json();
const meJson = me?.[0]?.result?.data?.json;
assert(meJson && meJson.id === owner.id, "auth.me retorna o usuário correto");

// ── 2. tRPC: dados reais que a TUI consome ───────────────────
const q = input => encodeURIComponent(JSON.stringify({ "0": { json: input, meta: { values: [] } } }));
const dmRes = await fetch(`${base}/api/trpc/dm.list?batch=1&input=${q(null)}`, {
  headers: { authorization: `Bearer ${cliToken}` },
});
assert(dmRes.ok, "dm.list com Bearer do CLI");
const dms = (await dmRes.json())[0]?.result?.data?.json;
assert(Array.isArray(dms), "dm.list retorna lista de conversas");
if (dms.length) {
  assert(!!dms[0].id && ("members" in dms[0] || "otherUser" in dms[0]), "conversa tem estrutura esperada");
  console.log("  → conversas:", dms.length, "| primeira:", dms[0].name || dms[0].otherUser?.name || "(sem nome)");
}

const frRes = await fetch(`${base}/api/trpc/friend.list?batch=1&input=${q(null)}`, {
  headers: { authorization: `Bearer ${cliToken}` },
});
assert(frRes.ok, "friend.list com Bearer do CLI");
const friends = (await frRes.json())[0]?.result?.data?.json;
assert(Array.isArray(friends), "friend.list retorna lista");

// ── 3. WebSocket realtime (/ws) com Bearer ───────────────────
const { WebSocket } = await import("ws");
const ws = new WebSocket(`ws://127.0.0.1:3210/ws`, {
  headers: { authorization: `Bearer ${cliToken}` },
});
// Coleta TODAS as mensagens desde já — o `ready` pode chegar no mesmo chunk
// do handshake (emitido no mesmo tick do `open`), antes de qualquer await.
const wsEvents = [];
ws.on("message", d => {
  try { wsEvents.push(JSON.parse(d.toString())); } catch { /* ignora */ }
});
await new Promise((res, rej) => {
  ws.once("open", res);
  ws.once("error", rej);
  setTimeout(() => rej(new Error("WS timeout")), 6000);
});
ws.on("close", (code, reason) => console.log("  [ws close]", code, reason.toString().slice(0, 60)));
const firstEvent = await new Promise((res, rej) => {
  const found = wsEvents.find(e => e.t === "ready");
  if (found) return res(found);
  const iv = setInterval(() => {
    const f = wsEvents.find(e => e.t === "ready");
    if (f) { clearInterval(iv); res(f); }
  }, 100);
  setTimeout(() => { clearInterval(iv); rej(new Error(`sem evento ready (recebidos: ${wsEvents.map(e => e.t).join(", ") || "nenhum"})`)); }, 8000);
});
assert(String(firstEvent.userId) === String(owner.id), "WS /ws aceita Bearer do CLI e envia ready");

// ── 4. Envio de mensagem via REST + broadcast realtime ───────
let convId = dms?.[0]?.id;
if (convId) {
  const msgPromise = new Promise(res => {
    const onMsg = d => {
      const ev = JSON.parse(d.toString());
      if (ev.t === "message:new") res(ev);
      ws.once("message", onMsg);
    };
    ws.once("message", onMsg);
    setTimeout(() => res(null), 8000);
  });

  const sendRes = await fetch(`${base}/api/trpc/message.send?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cliToken}` },
    // Batch POST: corpo é dicionário indexado ("0"), e sem `meta` — superjson
    // só inclui `meta` quando há valores transformados; `meta:{values:[]}`
    // vazio faz deserialize retornar undefined.
    body: JSON.stringify({
      "0": { json: { conversationId: convId, content: `nexora-cli e2e ${Date.now()}` } },
    }),
  });
  if (sendRes.ok) {
    const ev = await msgPromise;
    assert(!!ev, "message:new broadcast em realtime para o WS do CLI");
    console.log("  → evento:", ev.t, "| conteúdo contém marcador:", ev.message?.content?.includes("nexora-cli e2e") ?? "(campo diverso)");
  } else {
    const errBody = await sendRes.text().catch(() => "");
    throw new Error(`message.send falhou (HTTP ${sendRes.status}): ${errBody.slice(0, 300)}`);
  }
}

ws.close();
server.close();
console.log("\n★ E2E do Nexora CLI: TODOS OS PASSOS PASSARAM");
process.exit(0);
