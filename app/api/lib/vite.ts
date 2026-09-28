import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

// Linha canônica do AdSense. O mesmo conteúdo fica em public/ads.txt e em
// src/lib/adsense.ts; aqui o servidor nunca depende do arquivo em disco.
const ADSENSE_ADS_TXT_LINES = [
  "google.com, pub-9433688755768515, DIRECT, f08c47fec0942fa0",
];

export function serveStaticFiles(app: App) {
  const moduleDirectory = import.meta.dirname;
  const isSourceModule = moduleDirectory.endsWith(
    `${path.sep}api${path.sep}lib`
  );
  const distPath = path.resolve(
    moduleDirectory,
    isSourceModule ? "../../dist/public" : "../dist/public"
  );

  // Assets com hash no nome são imutáveis — cache de 1 ano.
  app.use("/assets/*", async (c, next) => {
    await next();
    if (c.res.status === 200) {
      c.res.headers.set(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
    }
  });
  // HTML/ícones/sw: sempre revalida.
  app.use("*", async (c, next) => {
    await next();
    if (
      c.res.status === 200 &&
      !c.req.path.startsWith("/assets/") &&
      !c.req.path.startsWith("/api/")
    ) {
      c.res.headers.set("Cache-Control", "no-cache");
    }
  });

  // ads.txt precisa responder 200 com text/plain na raiz do domínio, em
  // qualquer esquema/subdomínio, e não pode virar o fallback do SPA.
  app.get("/ads.txt", (c) => {
    c.header("Content-Type", "text/plain; charset=utf-8");
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(`${ADSENSE_ADS_TXT_LINES.join("\n")}\n`);
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  // Rotas que o SPA realmente atende. Qualquer outra coisa é 404 de verdade
  // (com o HTML do app no corpo, então o React Router renderiza a página de
  // "não encontrada") — evita soft 404 com status 200 para URLs inventadas.
  const SPA_ROUTES = [
    "/login",
    "/register",
    "/companion",
    "/mobile-camera",
    "/explore",
    "/cli",
    "/cli/login",
    "/invite",
    "/privacy",
    "/terms",
    "/legal",
    "/channels",
    "/nexora-admin",
  ];

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    let pathname = "/";
    try {
      pathname = new URL(c.req.url).pathname;
    } catch {
      // keep "/"
    }
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    const isSpaRoute =
      pathname === "/" ||
      SPA_ROUTES.some(r => pathname === r || pathname.startsWith(`${r}/`));
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    // Navegação legítima do app: 200. URL inexistente: 404 (fim do soft 404).
    return c.html(content, isSpaRoute ? 200 : 404);
  });
}
