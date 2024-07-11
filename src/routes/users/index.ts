import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getSessionStub, sessionMiddleware } from "@/middleware";
import { windowSchema } from "@/schema";
import { SyncEnv } from "@/types/env";

const app = new Hono<SyncEnv>().basePath("/:app-name");

app.use(
  "/:id/resize",
  cors({
    origin: "*",
    allowMethods: ["POST"],
    exposeHeaders: ["Content-Length"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.post("/register", async (c) => {
  const id = crypto.randomUUID();

  return c.json({ id });
});

app.get("/mode", async (c) => {
  const appName = c.req.param("app-name");

  const stub = getSessionStub(c, appName);

  const mode = await stub.getMode();

  return c.json({ mode });
});

app.get("/:id", sessionMiddleware, async (c) => {
  return c.var.session.fetch(c.req.raw);
});

app.get("/:id/state", async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const userId = c.req.param("id");

  const state = await stub.getUserState(userId);

  return c.json(state);
});

app.post("/:id/resize", zValidator("json", windowSchema), async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const userId = c.req.param("id");

  const window = c.req.valid("json");
  await stub.resize(userId, window);

  return c.json({ success: true });
});

export { app };
