import { serve } from "@hono/node-server";
import { serveStaticFiles } from "./lib/vite";
import { attachRealtime } from "./realtime";
import app from "./boot";

if (process.env.NODE_ENV === "production") {
  serveStaticFiles(app);
}

const port = parseInt(process.env.PORT || "3000");
const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`Server running on http://localhost:${port}/`);
});
attachRealtime(server as unknown as import("http").Server);
