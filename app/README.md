# Nexora

Nexora é uma plataforma de comunicação em tempo real com comunidades, canais de texto, mensagens diretas, presença, chamadas de voz e vídeo, compartilhamento de tela e uploads.

## Arquitetura

- Frontend: React 19, TypeScript, Vite e Tailwind CSS.
- API: Hono e tRPC.
- Tempo real: WebSocket (`ws`) e WebRTC.
- Banco: MySQL com Drizzle ORM.
- Produção: o servidor Node entrega `dist/public`, expõe `/api` e mantém `/ws` no mesmo processo.

## Desenvolvimento local

Requisitos: Node.js 22 e MySQL 8.

```bash
cp .env.example .env
npm install
npm run dev
```

O Vite abre em `http://localhost:5173` e encaminha `/api` e `/ws` ao backend em `http://localhost:3000`.

## Validação de produção

```bash
npm ci
npm run check
npm run build
npm run start
```

O build gera:

- `dist/public`: frontend estático;
- `dist/boot.js`: servidor Node completo, incluindo API e WebSocket.

O processo lê `PORT` do provedor e escuta em `0.0.0.0`. O endpoint de saúde é `/api/health`.

## Variáveis de ambiente

Use `.env.example` como referência. As variáveis obrigatórias do backend em produção são `APP_ID`, `APP_SECRET`, `DATABASE_URL`, `KIMI_AUTH_URL` e `KIMI_OPEN_URL`.

Para um deploy unificado, configure:

```env
APP_ORIGIN=https://seu-dominio.example
PUBLIC_API_URL=https://seu-dominio.example
ALLOWED_ORIGINS=https://seu-dominio.example
```

Para frontend e backend em domínios diferentes, configure também no build do frontend:

```env
VITE_API_URL=https://api.seu-dominio.example
VITE_WS_URL=wss://api.seu-dominio.example
```

No backend, `APP_ORIGIN` deve apontar para o frontend, `PUBLIC_API_URL` para o backend e `ALLOWED_ORIGINS` deve listar os frontends permitidos, separados por vírgula.

## Render

O arquivo `render.yaml` cria o serviço web completo com `rootDir: app`. Como ele está dentro da pasta da aplicação, selecione `app/render.yaml` no campo **Blueprint Path** do Render. Para configuração manual, mantenha `Root Directory = app`:

```text
Build Command: npm ci && npm run build
Start Command: npm run start
Health Check Path: /api/health
```

Cadastre as variáveis do backend no painel e, após receber a URL pública, preencha `APP_ORIGIN`, `PUBLIC_API_URL` e `ALLOWED_ORIGINS` com essa URL. O `DATABASE_URL` precisa apontar para um MySQL gerenciado acessível pelo Render; `localhost`/`127.0.0.1` apontam para o próprio contêiner e nunca para o computador local. Não envie o seu `.env` de desenvolvimento como Secret File.

O Blueprint aplica as migrations automaticamente no **Pre-Deploy Command** antes de iniciar o servidor. Em uma configuração manual, use também:

```text
Pre-Deploy Command: NODE_ENV=production npm run db:migrate
```

## Railway, Fly.io e outros hosts Node

Use os mesmos comandos de build e start. No Railway, configure `Root Directory = app`; o `railway.json` usa o `Dockerfile` validado. Em outros hosts com contêiner, use o mesmo arquivo:

```bash
docker build -t nexora .
docker run --env-file .env -p 3000:3000 nexora
```

## Netlify e Vercel

Netlify e Vercel publicam o frontend Vite usando `netlify.toml` e `vercel.json`:

```text
Build Command: npm ci && npm run build:client
Publish Directory: dist/public
```

Esses hosts não executam este backend WebSocket persistente como um site estático. Para preservar mensagens em tempo real, presença e chamadas, publique o backend em Render, Railway, Fly.io ou outro host Node e defina `VITE_API_URL` e `VITE_WS_URL` no frontend. Não é necessário alterar o código nem o `Root Directory`.

## Rotas SPA

O backend Node, Netlify e Vercel possuem fallback para `index.html`, permitindo abrir diretamente URLs como `/channels/@me` e `/invite/:code` sem erro 404.
