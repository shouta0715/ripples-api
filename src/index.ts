import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { SyncEnv } from "@/types/env";

const app = new Hono<SyncEnv>();

const sessionMiddleware = createMiddleware<SyncEnv>(async (c, next) => {
  const upgradeHeader = c.req.header("Upgrade");

  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return next();
  }

  const appName = c.req.param("app-name");

  const session = c.env.SESSION.idFromName(appName);

  const stub = c.env.SESSION.get(session);

  c.set("session", stub);

  return next();
});

app.post("/:app-name/register", async (c) => {
  const id = crypto.randomUUID();

  return c.json({ id });
});

app.get("/:app-name/:id", sessionMiddleware, async (c) => {
  return c.var.session.fetch(c.req.raw);
});

app.get("/:app-name/:id/admin", sessionMiddleware, async (c) => {
  return c.var.session.fetch(c.req.raw);
});

export { WebMultiViewSync } from "@/sync";
export { WebMultiViewSession } from "@/session";
export default app;
