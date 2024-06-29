/* eslint-disable class-methods-use-this */
import { DurableObjectStorage } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import { DeviceData, Mode } from "@/schema";
import { WebMultiViewSync } from "@/sync";
import { checkUUID, getRandomInitialPosition } from "@/utils";

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
  mode: Mode;
};

type UserState = {
  role: "user";
  width: number;
  height: number;
  assignPosition: AssignedPosition;
  displayname: string;
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

  // WebSocketを受け取った時の処理
  async webSocketMessage(ws: WebSocket, m: ArrayBuffer | string) {
    const session = this.sessions.get(ws);

    if (!session) return;

    const data = JSON.parse(m.toString()) as Data;

    this.broadcastUser(ws, data);
  }

  // 管理者にデータを送信する処理
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

  // ユーザーにデータを送信する処理
  async broadcastUser(ws: WebSocket, data: Data) {
    const sender = this.sessions.get(ws);
    if (!sender || sender.role === "admin") return;

    const sockets = this.getWebSocketsByRole("user");
    const admin = this.getWebSocketsByRole("admin");

    this.broadcastAdmin(admin, { action: "interaction", ...data }, sender.id);

    sockets.forEach((socket) => {
      const me = this.sessions.get(socket);

      if (!me || me.role === "admin") return;

      const { x, y } = data;

      const newX =
        x - me.assignPosition.startWidth + sender.assignPosition.startWidth;
      const newY =
        y - me.assignPosition.startHeight + sender.assignPosition.startHeight;

      socket.send(JSON.stringify({ x: newX, y: newY, senderId: sender.id }));
    });
  }

  // 初めてセッションを確立する際の処理
  async handleSession(ws: WebSocket, url: URL) {
    const lastPath = url.pathname.split("/").pop();

    let state: State;

    if (lastPath === "admin") {
      state = this.handleAdmin(url);
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
          displayname: userState.displayname,
        })
      );
    });
  }

  // 管理者のセッションを作成する際の処理
  handleAdmin(url: URL): AdminState {
    const allAdmins = this.getWebSocketsByRole("admin");

    if (allAdmins.length > 0) {
      const admin = allAdmins[0];

      const meta = this.sessions.get(admin) as AdminState;

      if (!meta) {
        throw new Error("Invalid meta");
      }

      return { role: "admin", id: meta.id, mode: meta.mode };
    }

    const id = crypto.randomUUID();

    const searchParams = new URLSearchParams(url.search);

    const mode = (searchParams.get("mode") || "view") as Mode;

    return { role: "admin", id, mode };
  }

  // ユーザーのセッションを作成する際の処理
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

    const { x, y } = getRandomInitialPosition();
    const assignPosition = {
      startWidth: x,
      startHeight: y,
      endWidth: parseInt(width, 10),
      endHeight: parseInt(height, 10),
    };

    const state = {
      role: "user" as const,
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      assignPosition,
      id,
      displayname: id,
    };

    return state;
  }

  // WebSocketが閉じられた時の処理
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

  // roleを指定してWebSocketを取得する
  getWebSocketsByRole(role: "admin" | "user") {
    return this.ctx.getWebSockets(role);
  }

  // 全ユーザーのセッションを取得する
  getUserSessions(): UserState[] {
    const sessions = Array.from(this.sessions.values());

    const users = sessions.filter(
      (session) => session.role === "user"
    ) as UserState[];

    return users;
  }

  // ユーザーの位置を変更するAPI
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

    const admin = this.getWebSocketsByRole("admin");

    admin.forEach((socket) => {
      socket.send(
        JSON.stringify({
          id,
          action: "position",
          assignPosition,
        })
      );
    });
  }

  async resize(id: string, window: { width: number; height: number }) {
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

  getSession(id: string): WebSocket | null {
    const sessions = this.ctx.getWebSockets(id);

    if (sessions.length !== 1 || !sessions[0]) {
      return null;
    }

    return sessions[0];
  }

  selectUser(id: string) {
    const session = this.getSession(id);

    if (!session) {
      throw new Error("Invalid user");
    }

    session.send(
      JSON.stringify({
        action: "select",
      })
    );
  }

  changeDisplayName(id: string, displayname: string) {
    const session = this.getSession(id);

    if (!session) {
      throw new Error("Invalid user");
    }

    const user = this.sessions.get(session);

    if (!user || user.role !== "user") {
      throw new Error("Invalid user");
    }

    this.sessions.set(session, { ...user, displayname });

    session.serializeAttachment({
      ...session.deserializeAttachment(),
      displayname,
    });

    const admin = this.getWebSocketsByRole("admin");

    admin.forEach((socket) => {
      socket.send(
        JSON.stringify({
          id,
          action: "displayname",
          displayname,
        })
      );
    });
  }

  changeDevice(id: string, device: DeviceData) {
    const session = this.getSession(id);

    if (!session) {
      throw new Error("Invalid user");
    }

    const user = this.sessions.get(session);

    if (!user || user.role !== "user") {
      throw new Error("Invalid user");
    }

    const assignPosition: AssignedPosition = {
      startWidth: device.x,
      startHeight: device.y,
      endWidth: device.x + user.width,
      endHeight: device.y + user.height,
    };

    this.sessions.set(session, {
      ...user,
      assignPosition,
      width: device.width,
      height: device.height,
    });

    session.serializeAttachment({
      ...session.deserializeAttachment(),
      assignPosition,
    });

    const admin = this.getWebSocketsByRole("admin");

    admin.forEach((socket) => {
      socket.send(
        JSON.stringify({
          ...user,
          assignPosition,
          width: device.width,
          height: device.height,
          id,
          action: "device",
          x: device.x,
          y: device.y,
        })
      );
    });
  }

  setMode(mode: Mode) {
    const admins = this.getWebSocketsByRole("admin");

    if (admins.length !== 1) {
      throw new Error("Invalid admin");
    }

    const session = admins[0];
    const meta = this.sessions.get(session);

    if (!meta || meta.role !== "admin") {
      throw new Error("Invalid admin");
    }

    this.sessions.set(session, { ...meta, mode });

    session.serializeAttachment({
      ...session.deserializeAttachment(),
      mode,
    });

    const users = this.getWebSocketsByRole("user");

    users.forEach((socket) => {
      socket.send(
        JSON.stringify({
          action: "mode",
          mode,
        })
      );
    });
  }

  getMode(): Mode {
    const admins = this.getWebSocketsByRole("admin");

    if (admins.length !== 1) {
      throw new Error("Invalid admin");
    }

    const session = admins[0];

    const meta = this.sessions.get(session);

    if (!meta || meta.role !== "admin") {
      throw new Error("Invalid admin");
    }

    return meta.mode;
  }
}
