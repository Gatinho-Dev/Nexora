import { authRouter } from "./auth-router";
import { accountRouter } from "./accountRouter";
import { serverRouter } from "./serverRouter";
import { messageRouter, forumRouter } from "./messageRouter";
import { friendRouter } from "./friendRouter";
import { dmRouter } from "./dmRouter";
import { notificationRouter } from "./notificationRouter";
import { officialRouter } from "./officialRouter";
import { badgeRouter } from "./badgeRouter";
import { adminRouter } from "./adminRouter";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  account: accountRouter,
  server: serverRouter,
  message: messageRouter,
  forum: forumRouter,
  friend: friendRouter,
  dm: dmRouter,
  notification: notificationRouter,
  official: officialRouter,
  badge: badgeRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
