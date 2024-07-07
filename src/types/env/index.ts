import { Context } from "hono";
import { WebMultiViewSession } from "@/session";

export type SyncEnv = {
  Bindings: {
    SESSION: DurableObjectNamespace<WebMultiViewSession>;
    readonly IMAGES: R2Bucket;
  };
  Variables: {
    session: DurableObjectStub<WebMultiViewSession>;
  };
};

export type SyncContext = Context<SyncEnv>;
