import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { BadRequestError } from "@/errors";
import { getSessionStub, sessionMiddleware } from "@/middleware";
import {
  changeDeviceSchema,
  connectionSchema,
  customSchema,
  displaynameSchema,
  modeSchema,
  positionSchema,
} from "@/schema";
import { SyncEnv } from "@/types/env";

const app = new Hono<SyncEnv>().basePath("/:app-name/admin");

app.use(
  "/customs",
  cors({
    origin: "*",
    allowMethods: ["POST"],
    exposeHeaders: ["Content-Length"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use(
  "/customs/:key",
  cors({
    origin: "*",
    allowMethods: ["DELETE", "PATCH"],
    exposeHeaders: ["Content-Length"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use(
  "/:id/*",
  cors({
    origin: "*",
    allowMethods: ["POST"],
    exposeHeaders: ["Content-Length"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use(
  "/mode",
  cors({
    origin: "*",
    allowMethods: ["POST"],
    exposeHeaders: ["Content-Length"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.get("/", sessionMiddleware, async (c) => {
  return c.var.session.fetch(c.req.raw);
});

app.post("mode", zValidator("json", modeSchema), async (c) => {
  const { mode } = c.req.valid("json");

  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  await stub.setMode(mode);

  return c.json({ success: true });
});

app.get("/customs", async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const customs = await stub.getCustoms();

  return c.json(customs);
});

app.post("/customs", zValidator("json", customSchema), async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const customs = c.req.valid("json");

  await stub.setCustom(customs);

  return c.json({ success: true });
});

app.delete("/customs/:key", async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const key = c.req.param("key");

  await stub.deleteCustom(key);

  return c.json({ success: true });
});

app.patch("/customs/:key", zValidator("json", customSchema), async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const key = c.req.param("key");
  const custom = c.req.valid("json");

  await stub.updateCustom(key, custom);

  return c.json({ success: true });
});

app.get("/sessions", async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const sessions = await stub.getUserSessions();

  return c.json(sessions);
});

app.post("/:id/position", zValidator("json", positionSchema), async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const userId = c.req.param("id");

  const position = c.req.valid("json");
  await stub.changePosition(userId, position);

  return c.json({ success: true });
});

app.post(
  "/:id/displayname",
  zValidator("form", displaynameSchema),
  async (c) => {
    const appName = c.req.param("app-name");
    const stub = getSessionStub(c, appName);

    const userId = c.req.param("id");

    const { displayname } = c.req.valid("form");
    await stub.changeDisplayName(userId, displayname);

    return c.json({ success: true });
  }
);

app.post("/:id/device", zValidator("json", changeDeviceSchema), async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const userId = c.req.param("id");

  const device = c.req.valid("json");

  await stub.changeDevice(userId, device);

  return c.json({ success: true });
});

app.post("/:id/connect", zValidator("json", connectionSchema), async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const connection = c.req.valid("json");

  const userId = c.req.param("id");
  if (userId !== connection.source) throw new BadRequestError("Invalid source");

  await stub.onConnect(userId, connection);

  return c.json({ success: true });
});

app.post("/:id/disconnect", zValidator("json", connectionSchema), async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const connection = c.req.valid("json");

  const userId = c.req.param("id");
  if (userId !== connection.source) throw new BadRequestError("Invalid source");

  await stub.onDisconnect(userId, connection);

  return c.json({ success: true });
});

export { app };
