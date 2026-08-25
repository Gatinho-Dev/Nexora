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

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
