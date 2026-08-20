import { authRouter } from "./auth-router";
import { accountRouter } from "./accountRouter";
import { serverRouter } from "./serverRouter";
import { messageRouter } from "./messageRouter";
import { friendRouter } from "./friendRouter";
import { dmRouter } from "./dmRouter";
import { notificationRouter } from "./notificationRouter";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  account: accountRouter,
  server: serverRouter,
  message: messageRouter,
  friend: friendRouter,
  dm: dmRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
