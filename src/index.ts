import { Hono } from "hono";

import { app as admin } from "@/routes/admin";
import { app as images } from "@/routes/images";
import { app as users } from "@/routes/users";
import { SyncEnv } from "@/types/env";

const app = new Hono<SyncEnv>();

app.route("/", admin);
app.route("/", users);
app.route("/", images);

export { WebMultiViewSession } from "@/session";
export default app;
