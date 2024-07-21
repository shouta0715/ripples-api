/* eslint-disable class-methods-use-this */
import { DurableObjectStorage } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import { AdminSession } from "@/class/admin";
import { UserSession } from "@/class/users";
import { BadRequestError, InternalServerError } from "@/errors";
import {
  Connection,
  DeviceData,
  Mode,
  OverSchema,
  PositionSchema,
} from "@/schema";

import { AdminMessage, AdminState } from "@/types/admin";

import { SyncEnv } from "@/types/env";
import { InteractionMessage, UserState } from "@/types/users";
import { checkUUID, json, parse } from "@/utils";

export class WebMultiViewSession extends DurableObject<SyncEnv["Bindings"]> {
  // 接続されているユーザーの情報を保持するMap
  users = new Map<WebSocket, UserState>();

  images: string[] = [];

  // 管理者の情報を保持する
  admin: AdminSession | null;

  state: DurableObjectState;

  storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: SyncEnv["Bindings"]) {
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
    const url = new URL(req.url);
    // app-name/images or app-name/images/<uuid?
    const lastPath = url.pathname.split("/").pop();
    const secondLastPath = url.pathname.split("/").slice(-2)[0];

    if (lastPath === "upload" || secondLastPath === "images") {
      return this.handleImageRequest(req);
    }

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
    const admin = new AdminSession(
      ws,
      this.updatedAdminUsers.bind(this),
      this.users
    );

    this.admin = admin;

    return admin.state;
  }

  private handleUser(ws: WebSocket, url: URL): UserSession {
    const user = new UserSession(ws, undefined, url, this.updatedUsers);

    return user;
  }

  private updatedAdminUsers(
    _: WebSocket,
    __: AdminState,
    meta?: Map<WebSocket, UserState>
  ) {
    if (meta) {
      this.users = meta;
    }
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
    ここからは、画像のアップロードと取得を処理するためのメソッドです。
  ****************************** */

  private async handleImageRequest(req: Request): Promise<Response> {
    switch (req.method) {
      case "POST":
        return this.uploadImage(req);
      case "GET":
        return this.getImageData(req);
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  private async uploadImage(req: Request): Promise<Response> {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return new Response("Image not found", { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    const id = crypto.randomUUID();

    await this.env.IMAGES.put(id, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    this.images.push(id);

    // this.saveImages();

    this.admin?.onAction({ action: "uploaded", id });

    const { users } = this;

    for (const meta of users) {
      const user = this.admin?.getUser(meta[0]);

      user?.onAction({ action: "uploaded", id });
    }

    return new Response(json({ id }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  private async getImageData(req: Request): Promise<Response> {
    const url = new URL(req.url);

    const lastPath = url.pathname.split("/").pop();

    if (!lastPath || checkUUID(lastPath) === false) {
      throw new BadRequestError("Invalid ID");
    }

    const image = await this.env.IMAGES.get(lastPath);

    if (!image) throw new BadRequestError("Image not found");

    const headers = new Headers();
    image.writeHttpMetadata(headers);
    headers.set("etag", image.httpEtag);
    headers.set("cache-control", "public, max-age=31536000");

    return new Response(image.body, {
      headers,
    });
  }

  private saveImages() {
    const { admin } = this;

    if (!admin) throw new InternalServerError("Admin is not connected");

    admin.ws.serializeAttachment({
      ...admin.ws.deserializeAttachment(),
      images: this.images,
    });
  }

  /** ****************************
    ここからは、POSTでのリクエストを処理するためのメソッドです。
    routerから呼び出されます。
  ****************************** */

  changePosition(id: string, data: PositionSchema) {
    const ws = this.getUserWsById(id);
    this.admin?.onAction({ action: "position", ...data, id, ws });
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

  uploadedImage(id: string) {
    this.admin?.onAction({ action: "uploaded", id });

    for (const meta of this.users) {
      const user = this.admin?.getUser(meta[0]);

      user?.onAction({ action: "uploaded", id });
    }
  }

  onOver(id: string, data: OverSchema) {
    const ws = this.getUserWsById(id);

    const sender = this.users.get(ws);
    if (!sender) throw new InternalServerError("Invalid sender");

    const { connections } = sender;
    if (connections.length === 0) return;

    for (const connection of connections) {
      if (connection.source !== data.id) continue;
      if (connection.from !== data.direction) continue;

      const target = this.getUserWsById(connection.target);
      const user = this.admin?.getUser(target);
      if (!user) continue;

      user.onAction({ ...data, ...connection, sender, action: "interaction" });
    }
  }

  onConnect(id: string, data: Connection) {
    const ws = this.getUserWsById(id);
    this.admin?.onAction({ action: "connection", ...data, ws });
  }

  getUserState(id: string): UserState {
    const ws = this.getUserWsById(id);

    const user = this.admin?.getUser(ws);

    if (!user) throw new BadRequestError("Invalid user");

    return user.getState();
  }
}
