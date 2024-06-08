/* eslint-disable class-methods-use-this */
import { DurableObjectStorage } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import { WebMultiViewSync } from "@/sync";
import { checkUUID } from "@/utils";

type Sync = { SYNC: DurableObjectNamespace<WebMultiViewSync> };

type AssignedPosition = {
  startWidth: number;
  startHeight: number;
  endWidth: number;
  endHeight: number;
};

type AdminState = {
  role: "admin";
  id: string;
};

type UserState = {
  role: "user";
  width: number;
  height: number;
  assignPosition: AssignedPosition;
  id: string;
};

type State = AdminState | UserState;

type Data = {
  x: number;
  y: number;
};

export class WebMultiViewSession extends DurableObject<Sync> {
  users = new Map<string, State>();

  sessions = new Map<WebSocket, State>();

  state: DurableObjectState;

  storage: DurableObjectStorage;

  env: Sync;

  timestamp = 0;

  constructor(state: DurableObjectState, env: Sync) {
    console.log("Session created");
    super(state, env);

    this.state = state;
    this.storage = state.storage;
    this.env = env;

    this.sessions = new Map();

    this.state.getWebSockets().forEach((ws) => {
      const meta = ws.deserializeAttachment();

      this.sessions.set(ws, { ...meta });
    });
  }

  async fetch(req: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    await this.handleSession(server, new URL(req.url));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, m: ArrayBuffer | string) {
    const session = this.sessions.get(ws);

    if (!session) return;

    const isAdmin = session.role === "admin";
    const data = JSON.parse(m.toString()) as Data;

    if (isAdmin) {
      this.broadcastAdmin(ws, data, session.id);
    }

    this.broadcastUser(ws, data);
  }

  async broadcastAdmin(ws: WebSocket, data: Data, senderId: string) {
    ws.send(JSON.stringify({ ...data, id: senderId }));
  }

  async broadcastUser(ws: WebSocket, data: Data) {
    const sender = this.sessions.get(ws);
    if (!sender) return;

    if (sender.role === "admin") return;

    const sockets = this.ctx.getWebSockets();

    for (const socket of sockets) {
      const me = this.sessions.get(socket);
      if (!me) continue;
      const isAdmin = me.role === "admin";

      if (isAdmin) {
        this.broadcastAdmin(socket, data, sender.id);
        continue;
      }

      const { x, y } = data;

      const newX =
        x - me.assignPosition.startWidth + me.assignPosition.startWidth;
      const newY =
        y - me.assignPosition.startHeight + me.assignPosition.startHeight;

      socket.send(JSON.stringify({ x: newX, y: newY, id: me.id }));
    }
  }

  async handleSession(ws: WebSocket, url: URL) {
    const lastPath = url.pathname.split("/").pop();

    let state: State;

    if (lastPath === "admin") {
      state = this.handleAdmin();
    } else {
      state = this.handleUser(url);
    }

    this.state.acceptWebSocket(ws, [state.role]);

    ws.serializeAttachment({ ...ws.deserializeAttachment(), ...state });

    this.sessions.set(ws, state);
  }

  handleAdmin(): AdminState {
    const id = crypto.randomUUID();

    return { role: "admin", id };
  }

  handleUser(url: URL): UserState {
    const id = url.pathname.split("/").pop();

    if (checkUUID(id) === false || !id) {
      throw new Error("Invalid UUID");
    }

    const width = url.searchParams.get("width");
    const height = url.searchParams.get("height");

    if (!width || !height) {
      throw new Error("Invalid width or height");
    }

    const assignPosition = {
      startWidth: 0,
      startHeight: 0,
      endWidth: parseInt(width, 10),
      endHeight: parseInt(height, 10),
    };

    const state = {
      role: "user" as const,
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      assignPosition,
      id,
    };

    return state;
  }

  async closeOrErrorHandler(ws: WebSocket) {
    const session = this.sessions.get(ws);

    if (!session) return;

    this.sessions.delete(ws);

    const admin = this.ctx.getWebSockets("admin");

    if (admin.length === 0) return;

    admin.forEach((socket) => {
      socket.send(
        JSON.stringify({
          id: session.id,
          message: `User ${session.id} has left`,
        })
      );
    });
  }

  async webSocketClose(ws: WebSocket) {
    this.closeOrErrorHandler(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.closeOrErrorHandler(ws);
  }
}
