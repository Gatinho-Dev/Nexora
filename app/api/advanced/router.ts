import { createRouter } from "../middleware";
import { messageFeaturesRouter } from "./messageFeaturesRouter";
import { profileFeaturesRouter } from "./profileFeaturesRouter";
import { securityFeaturesRouter } from "./securityFeaturesRouter";
import { serverFeaturesRouter } from "./serverFeaturesRouter";
import { supportFeaturesRouter } from "./supportFeaturesRouter";

export const advancedRouter = createRouter({
  messages: messageFeaturesRouter,
  profile: profileFeaturesRouter,
  security: securityFeaturesRouter,
  server: serverFeaturesRouter,
  support: supportFeaturesRouter,
});
