import http from "node:http";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { signSessionToken } from "../api/auth/token";
import { createSession } from "../api/auth/sessions";
import { getDb } from "../api/queries/connection";
import * as schema from "../db/schema";
import { Session } from "../contracts/constants";

const port = 5174;

http
  .createServer(async (request, response) => {
    if (request.url === "/__codex_preview_login") {
      const user = await getDb().query.users.findFirst({
        where: eq(schema.users.id, 1),
      });
      if (!user) {
        response.writeHead(404).end("Local preview user not found");
        return;
      }
      const sid = nanoid(24);
      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: "nexora",
        sid,
      });
      await createSession({
        userId: user.id,
        sid,
        token,
        userAgent: request.headers["user-agent"],
        ip: "127.0.0.1",
      });
      response.writeHead(302, {
        location: "/channels/@me",
        "set-cookie": `${Session.cookieName}=${token}; HttpOnly; Path=/; SameSite=Lax`,
      });
      response.end();
      return;
    }

    const targetPort = request.url?.startsWith("/api/") ? 3000 : 5173;
    const proxy = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, host: `localhost:${targetPort}` },
      },
      upstream => {
        response.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(response);
      },
    );
    proxy.on("error", error => {
      response.writeHead(502).end(error.message);
    });
    request.pipe(proxy);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Preview proxy running on http://localhost:${port}`);
  });
