import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import { serverRouter } from "./serverRouter";

function caller(user?: TrpcContext["user"]) {
  return serverRouter.createCaller({
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user,
  });
}

describe("server discovery authorization", () => {
  it("requires authentication for discovery and direct joining", async () => {
    await expect(
      caller().discover({ sort: "recommended" })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller().joinDiscoverable({ serverId: 1, acceptedRules: false })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
