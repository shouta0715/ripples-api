import { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { SyncEnv } from "@/types/env";

export const getSessionStub = (c: Context<SyncEnv>, appName: string) => {
  const session = c.env.SESSION.idFromName(appName);

  const stub = c.env.SESSION.get(session);

  return stub;
};

export const sessionMiddleware = createMiddleware<SyncEnv>(async (c, next) => {
  const upgradeHeader = c.req.header("Upgrade");

  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return next();
  }

  const appName = c.req.param("app-name");

  const stub = getSessionStub(c, appName);

  c.set("session", stub);

  return next();
});
