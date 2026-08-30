import { serve } from "@hono/node-server";
import { serveStaticFiles } from "./lib/vite";
import { attachRealtime } from "./realtime";
import app from "./boot";
import { resumePendingModeration } from "./services/mediaModeration";
import { resumePendingDeepReviews } from "./services/reports/deepMediaReview";
import { resumePendingTextHistoryReviews } from "./services/reports/textHistoryReview";

if (process.env.NODE_ENV === "production") {
  serveStaticFiles(app);
}

const port = parseInt(process.env.PORT || "3000");
const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`Server running on http://localhost:${port}/`);
  void Promise.allSettled([
    resumePendingModeration(),
    resumePendingDeepReviews(),
    resumePendingTextHistoryReviews(),
  ]).then(results => {
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          "[safety] Failed to resume a moderation queue.",
          result.reason
        );
      }
    }
  });
});
attachRealtime(server as unknown as import("http").Server);
