import { Hono } from "hono";

import { app as admin } from "@/routes/admin";
import { app as users } from "@/routes/users";
import { SyncEnv } from "@/types/env";

const app = new Hono<SyncEnv>();

app.route("/", admin);
app.route("/", users);

export { WebMultiViewSync } from "@/sync";
export { WebMultiViewSession } from "@/session";
export default app;
