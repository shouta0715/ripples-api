import { Context } from "hono";
import { WebMultiViewSession } from "@/session";

export type SyncEnv = {
  Bindings: {
    SESSION: DurableObjectNamespace<WebMultiViewSession>;
  };
  Variables: {
    session: DurableObjectStub<WebMultiViewSession>;
  };
};

export type SyncContext = Context<SyncEnv>;
