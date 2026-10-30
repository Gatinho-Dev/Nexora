import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./auth/middleware";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  sessionId?: string;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    const { user, sessionId } = await authenticateRequest(opts.req.headers);
    ctx.user = user;
    ctx.sessionId = sessionId;
  } catch {
    // Authentication is optional here
  }
  return ctx;
}
