import { Hono } from "hono";
import { cors } from "hono/cors";
import { getSessionStub } from "@/middleware";
import { SyncEnv } from "@/types/env";

const app = new Hono<SyncEnv>().basePath("/:app-name/images");

app.use(
  "/upload",
  cors({
    origin: "*",
    allowMethods: ["POST"],
    allowHeaders: ["Content-Type"],
  })
);

app.post("/upload", async (c) => {
  const appName = c.req.param("app-name");

  const stub = getSessionStub(c, appName);

  const res = await stub.fetch(c.req.raw);

  return c.json(res);
});

app.get("/:id", async (c) => {
  const appName = c.req.param("app-name");
  const stub = getSessionStub(c, appName);

  const res = await stub.fetch(c.req.raw);

  return res;
});

export { app };
