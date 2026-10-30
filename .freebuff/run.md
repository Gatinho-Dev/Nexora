# Nexora — Run Doc (preview deste worktree)

Projeto: Nexora (React/Vite SPA + API Hono/tRPC + WebSocket no mesmo processo).

## Como reproduzir os artefatos não-versionados

1. **Dependências** — `node_modules` já existe neste worktree. Em um checkout
   novo: `npm install` (gerenciador: npm; há `package-lock.json`).
2. **Arquivo `.env`** — copie de `/home/daniel/Downloads/app/app/.env`
   (checkout principal) para `app/.env` deste worktree e ajuste `DATABASE_URL`
   se necessário. Este preview usa o **TiDB Cloud remoto** (o mesmo banco da
   Nexora em produção). A credencial vive somente no `.env` — nunca copie o
   valor para cá nem para o git. Nota: o valor contém `?ssl={...}` com chaves;
   mantenha entre aspas no arquivo (o dotenv da API aceita a linha crua, mas
   shell scripts precisam de aspas).
3. **Migrations** — o `npm run dev` NÃO aplica migrations. Rode uma vez após
   trocar o `.env`:
   ```bash
   npm run db:migrate
   ```
   (Validado: aplica `0023_nexora_live.sql` no TiDB.)
4. **MySQL local (alternativa, não usada neste preview)** — há um
   `docker-compose.yml` com volume `app_mysql_data`; o contêiner antigo pode
   ser reativado com `docker start pulsar_mysql`. O snapshot local está atrás
   (falta 0021–0023) — prefira o TiDB remoto.

## Como rodar o servidor

Na pasta `app/` deste worktree:

```bash
npm run db:migrate   # uma vez, após apontar o DATABASE_URL
PORT=3000 npm run dev
```

**Sempre passe `PORT=3000` explicitamente.** O `.env` de desenvolvimento não
define `PORT` e o dotenv injeta valores que podem quebrar o
`parseInt(process.env.PORT)` no boot (o servidor pode subir em `:0`).

O `npm run dev` sobe dois processos (concurrently):

- **API + WebSocket** em `http://localhost:3000` (`tsx watch api/server.ts`)
  — gateway `/ws/live` incluso;
- **Vite** em `http://localhost:5173` com proxy de `/api` e `/ws` para a 3000.

**URL de preview: `http://localhost:5173`** (frontend de desenvolvimento).

Saúde: `curl http://localhost:3000/api/health` deve responder
`{"status":"ok",...}` e o log deve conter `[live] WebSocket gateway attached
at /ws/live`.

Start detached (Linux), a partir de `app/`:

```bash
{ setsid nohup env PORT=3000 npm run dev > "/home/daniel/Downloads/app/.freebuff/preview.log" 2>&1 < /dev/null & echo "pid=$!"; disown; }
```

Se o launcher colher o grupo de processos (pid some em segundos, log vazio),
relance via `bash -c 'setsid nohup env PORT=3000 npm run dev > LOG 2>&1 < /dev/null &'`.
