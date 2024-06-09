import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";
import { positionSchema, windowSchema } from "@/schema";
import { SyncEnv } from "@/types/env";

const app = new Hono<SyncEnv>();

app.use(
  "/:app-name/admin/:id/position",
  cors({
    origin: "*",
    allowMethods: ["POST"],
    exposeHeaders: ["Content-Length"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use(
  "/:app-name/:id/resize",
  cors({
    origin: "*",
    allowMethods: ["POST"],
    exposeHeaders: ["Content-Length"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

const getSessionStub = (c: Context<SyncEnv>, appName: string) => {
  const session = c.env.SESSION.idFromName(appName);

  const stub = c.env.SESSION.get(session);

  return stub;
};

const sessionMiddleware = createMiddleware<SyncEnv>(async (c, next) => {
  const upgradeHeader = c.req.header("Upgrade");

  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return next();
  }

  const appName = c.req.param("app-name");

  const stub = getSessionStub(c, appName);

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

app.post(
  "/:app-name/:id/resize",
  validator("json", (v, c) => {
    const parsed = windowSchema.safeParse(v);

    if (!parsed.success) {
      return c.text("Invalid!", 401);
    }

    return parsed.data;
  }),
  async (c) => {
    const appName = c.req.param("app-name");
    const stub = getSessionStub(c, appName);

    const userId = c.req.param("id");

    const window = c.req.valid("json");
    await stub.resize(userId, window);

    return c.json({ success: true });
  }
);

app.get("/:app-name/admin", sessionMiddleware, async (c) => {
  return c.var.session.fetch(c.req.raw);
});

app.get("/:app-name/admin/sessions", async (c) => {
  const appName = c.req.param("app-name");

  const stub = getSessionStub(c, appName);

  const sessions = await stub.getUserSessions();

  return c.json(sessions);
});

app.post(
  "/:app-name/admin/:id/position",
  validator("json", (v, c) => {
    const parsed = positionSchema.safeParse(v);

    if (!parsed.success) {
      return c.text("Invalid!", 401);
    }

    return parsed.data;
  }),
  async (c) => {
    const appName = c.req.param("app-name");
    const stub = getSessionStub(c, appName);

    const userId = c.req.param("id");

    const position = c.req.valid("json");
    await stub.changePosition(userId, position);

    return c.json({ success: true });
  }
);

export { WebMultiViewSync } from "@/sync";
export { WebMultiViewSession } from "@/session";
export default app;
