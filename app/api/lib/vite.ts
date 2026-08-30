import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

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
    if (c.res.status === 200 && !c.req.path.startsWith("/assets/")) {
      c.res.headers.set("Cache-Control", "no-cache");
    }
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  // Rotas que o SPA realmente atende. Qualquer outra coisa é 404 de verdade
  // (com o HTML do app no corpo, então o React Router renderiza a página de
  // "não encontrada") — evita soft 404 com status 200 para URLs inventadas.
  const SPA_ROUTES = [
    "/login",
    "/register",
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
