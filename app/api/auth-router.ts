import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { revokeSession } from "./auth/sessions";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { kickSession } from "./realtime";
import { toPublicUser } from "./utils/permissions";

export const authRouter = createRouter({
  me: authedQuery.query((opts) => toPublicUser(opts.ctx.user)),
  logout: publicQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    if (ctx.user && ctx.sessionId) {
      await revokeSession(ctx.sessionId, ctx.user.id);
      kickSession(ctx.sessionId);
      void getDb()
        .insert(schema.securityEvents)
        .values({ userId: ctx.user.id, type: "logout", severity: "info" })
        .catch(() => {});
    }
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
