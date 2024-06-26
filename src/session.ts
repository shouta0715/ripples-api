/* eslint-disable class-methods-use-this */
import { DurableObjectStorage } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import { Env } from "hono";
import { AdminSession } from "@/class/admin";
import { UserSession } from "@/class/users";
import { BadRequestError, InternalServerError } from "@/errors";
import { DeviceData, Mode } from "@/schema";

import { AdminMessage, AdminState } from "@/types/admin";
import { InteractionMessage, UserState } from "@/types/users";
import { json, parse } from "@/utils";

export class WebMultiViewSession extends DurableObject {
  // 接続されているユーザーの情報を保持するMap
  users = new Map<WebSocket, UserState>();

  // 管理者の情報を保持する
  admin: AdminSession | null;

  state: DurableObjectState;

  storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    this.state = state;
    this.storage = state.storage;
    this.env = env;
    this.admin = null;

    this.users = new Map();

    this.state.getWebSockets("user").forEach((ws) => {
      const meta = ws.deserializeAttachment();

      this.users.set(ws, meta);
    });

    this.state.getWebSockets("admin").forEach((ws) => {
      this.admin = new AdminSession(ws, this.updatedAdminUsers, this.users);
    });
  }

  /** ****************************
    以下からは、組み込みAPIをoverrideして、WebSocketの接続を処理するためのメソッドです
  ****************************** */

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
    if (this.admin?.ws === ws) {
      const data = parse<AdminMessage>(m);
      this.admin?.onAction(data);

      return;
    }

    const data = parse<InteractionMessage>(m);

    this.broadcastUser(ws, data);
  }

  async webSocketClose(ws: WebSocket) {
    this.closeOrErrorHandler(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.closeOrErrorHandler(ws);
  }

  /** ****************************
    ここからは、WebSocketの接続を処理するためのメソッドです。外部からは呼び出されません
  ****************************** */

  private async broadcastUser(ws: WebSocket, data: InteractionMessage) {
    this.admin?.onAction({ data, action: "interaction" });
    const { users } = this;

    const sender = users.get(ws);
    if (!sender) throw new InternalServerError("Invalid sender");

    for (const meta of users) {
      const user = this.admin?.getUser(meta[0]);

      if (!user) throw new InternalServerError("User not found");

      user.onAction({ ...data, sender, action: "interaction" });
    }
  }

  private async handleSession(ws: WebSocket, url: URL) {
    const lastPath = url.pathname.split("/").pop();

    if (lastPath === "admin") {
      const state = this.handleAdmin(ws);

      this.state.acceptWebSocket(ws, [state.role, state.id]);

      return;
    }

    if (!this.admin) throw new InternalServerError("Admin is not connected");

    const user = this.handleUser(ws, url);

    this.state.acceptWebSocket(ws, [user.role, user.id]);

    this.admin.onAction({ action: "join", user: user.getState(), ws });
  }

  private handleAdmin(ws: WebSocket): AdminState {
    const admin = new AdminSession(ws, this.updatedAdminUsers, this.users);

    this.admin = admin;

    return admin.state;
  }

  private handleUser(ws: WebSocket, url: URL): UserSession {
    const user = new UserSession(ws, undefined, url, this.updatedUsers);

    return user;
  }

  private updatedAdminUsers(_: WebSocket, state: AdminState) {
    this.users = state.users;
  }

  private updatedUsers(ws: WebSocket, state: UserState) {
    this.users.set(ws, state);
  }

  private getUserWsById(id: string): WebSocket {
    const sessions = this.state.getWebSockets(id);

    if (!sessions.length) throw new BadRequestError("Invalid user");
    if (sessions.length > 1)
      throw new InternalServerError("Multiple users found");

    const [ws] = sessions;

    return ws;
  }

  private async closeOrErrorHandler(ws: WebSocket) {
    this.admin?.onAction({ action: "leave", ws });
    ws.close();
  }

  /** ****************************
    ここからは、POSTでのリクエストを処理するためのメソッドです。
    routerから呼び出されます。
  ****************************** */

  changePosition(id: string, position: { x: number; y: number }) {
    const ws = this.getUserWsById(id);
    this.admin?.onAction({ action: "position", ...position, id, ws });
  }

  resize(id: string, window: { width: number; height: number }) {
    const session = this.ctx.getWebSockets(id)[0];

    const user = this.admin?.getUser(session);

    if (!user || user.role !== "user") {
      throw new BadRequestError("Invalid user");
    }

    user.onAction({ action: "resize", ...window });

    this.admin?.ws.send(json({ action: "resize", ...user.getState() }));
  }

  changeDisplayName(id: string, displayname: string) {
    const ws = this.getUserWsById(id);
    this.admin?.onAction({ action: "displayname", displayname, id, ws });
  }

  changeDevice(id: string, device: DeviceData) {
    const ws = this.getUserWsById(id);
    this.admin?.onAction({ action: "device", device, id, ws });
  }

  setMode(mode: Mode) {
    this.admin?.onAction({ action: "mode", mode });

    for (const meta of this.users) {
      const user = this.admin?.getUser(meta[0]);
      if (!user) throw new InternalServerError("User not found");

      user.onAction({ action: "mode", mode });
    }
  }

  getUserSessions(): UserState[] {
    const users = Array.from(this.users.values());

    return users;
  }

  getMode(): Mode {
    if (!this.admin) throw new InternalServerError("Admin is not connected");

    return this.admin.state.mode;
  }
}
