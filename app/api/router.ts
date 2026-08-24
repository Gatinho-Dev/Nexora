import { authRouter } from "./auth-router";
import { accountRouter } from "./accountRouter";
import { serverRouter } from "./serverRouter";
import { messageRouter, forumRouter } from "./messageRouter";
import { friendRouter } from "./friendRouter";
import { dmRouter } from "./dmRouter";
import { groupRouter } from "./groupRouter";
import { notificationRouter } from "./notificationRouter";
import { officialRouter } from "./officialRouter";
import { badgeRouter } from "./badgeRouter";
import { adminRouter } from "./adminRouter";
import { safetyRouter } from "./safetyRouter";
import { threadRouter, announceRouter, webhookRouter } from "./communityRouters";
import { pollRouter } from "./pollRouter";
import { commandRouter } from "./services/commandRouter";
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
  group: groupRouter,
  notification: notificationRouter,
  official: officialRouter,
  badge: badgeRouter,
  admin: adminRouter,
  safety: safetyRouter,
  threads: threadRouter,
  poll: pollRouter,
  command: commandRouter,
  announce: announceRouter,
  webhook: webhookRouter,
});

export type AppRouter = typeof appRouter;
