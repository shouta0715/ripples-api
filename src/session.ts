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

type AdminData = {
  action: "interaction" | "join" | "leave";
} & Partial<Data>;

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

    const data = JSON.parse(m.toString()) as Data;

    this.broadcastUser(ws, data);
  }

  broadcastAdmin(
    ws: WebSocket | WebSocket[],
    data: AdminData,
    senderId: string
  ) {
    const sendData = JSON.stringify({ ...data, id: senderId });

    if (Array.isArray(ws)) {
      ws.forEach((socket) => {
        socket.send(sendData);
      });
    } else {
      ws.send(sendData);
    }
  }

  async broadcastUser(ws: WebSocket, data: Data) {
    const sender = this.sessions.get(ws);
    if (!sender || sender.role === "admin") return;

    const sockets = this.getWebSocketsByRole("user");
    const admin = this.getWebSocketsByRole("admin");

    this.broadcastAdmin(admin, { action: "interaction", ...data }, sender.id);

    for (const socket of sockets) {
      const me = this.sessions.get(socket);

      if (!me || me.role === "admin") continue;

      const { x, y } = data;

      const newX =
        x - me.assignPosition.startWidth + sender.assignPosition.startWidth;
      const newY =
        y - me.assignPosition.startHeight + sender.assignPosition.startHeight;

      socket.send(JSON.stringify({ x: newX, y: newY, id: sender.id }));
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

    this.state.acceptWebSocket(ws, [state.role, state.id]);

    ws.serializeAttachment({ ...ws.deserializeAttachment(), ...state });

    this.sessions.set(ws, state);

    const admin = this.getWebSocketsByRole("admin");

    if (lastPath === "admin" || admin.length === 0) return;

    if (state.role === "admin") return;
    const userState = state as UserState;
    admin.forEach((socket) => {
      socket.send(
        JSON.stringify({
          action: "join",
          id: state.id,
          width: userState.width,
          height: userState.height,
          assignPosition: userState.assignPosition,
        })
      );
    });
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
          action: "leave",
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

  getWebSocketsByRole(role: "admin" | "user") {
    return this.ctx.getWebSockets(role);
  }

  getUserSessions(): UserState[] {
    const sessions = Array.from(this.sessions.values());

    const users = sessions.filter(
      (session) => session.role === "user"
    ) as UserState[];

    return users;
  }

  async changePosition(id: string, position: { x: number; y: number }) {
    const sessions = this.ctx.getWebSockets(id);

    if (sessions.length !== 1 || !sessions[0]) {
      throw new Error("Invalid session");
    }

    const session = sessions[0];

    const user = this.sessions.get(session);

    if (!user || user.role !== "user") {
      throw new Error("Invalid user");
    }

    const assignPosition: AssignedPosition = {
      startWidth: position.x,
      startHeight: position.y,
      endWidth: position.x + user.width,
      endHeight: position.y + user.height,
    };

    this.sessions.set(session, { ...user, assignPosition });

    session.serializeAttachment({
      ...session.deserializeAttachment(),
      assignPosition,
    });
  }

  resize(id: string, window: { width: number; height: number }) {
    const sessions = this.ctx.getWebSockets(id);

    if (sessions.length !== 1 || !sessions[0]) {
      throw new Error("Invalid session");
    }

    const session = sessions[0];

    const user = this.sessions.get(session);

    if (!user || user.role !== "user") {
      throw new Error("Invalid user");
    }

    const assignPosition: AssignedPosition = {
      ...user.assignPosition,
      endWidth: user.assignPosition.startWidth + window.width,
      endHeight: user.assignPosition.startHeight + window.height,
    };

    this.sessions.set(session, {
      ...user,
      width: window.width,
      height: window.height,
      assignPosition,
    });

    session.serializeAttachment({
      ...session.deserializeAttachment(),
      width: window.width,
      height: window.height,
      assignPosition,
    });

    const admin = this.getWebSocketsByRole("admin");

    admin.forEach((socket) => {
      socket.send(
        JSON.stringify({
          id,
          action: "resize",
          width: window.width,
          height: window.height,
        })
      );
    });
  }
}
