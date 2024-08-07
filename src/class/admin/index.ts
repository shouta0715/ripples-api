import { WebSocket } from "@cloudflare/workers-types";
import { BasicSession } from "@/class/common";
import { UserSession } from "@/class/users";
import { BadRequestError } from "@/errors";
import { Session } from "@/models/sessions";
import {
  AdminActions,
  AdminMessage,
  AdminState,
  AdminJoinMessage,
  AdminLeaveMessage,
  AdminModeMessage,
  AdminInteractionMessage,
  AdminDeviceMessage,
  AdminDisplaynameMessage,
  AdminPositionMessage,
  AdminConnectMessage,
  AdminDisconnectMessage,
} from "@/types/admin";
import { UserState } from "@/types/users";
import { json } from "@/utils";

export class AdminSession
  extends BasicSession<
    AdminState,
    AdminActions,
    AdminMessage,
    Map<WebSocket, UserState>
  >
  implements Session<AdminState, AdminActions, AdminMessage>
{
  users: Map<WebSocket, UserState> = new Map();

  constructor(
    ws: WebSocket,
    cb: (
      ws: WebSocket,
      state: AdminState,
      meta?: Map<WebSocket, UserState>
    ) => void,
    initialUsers: Map<WebSocket, UserState>
  ) {
    const initialState: AdminState = {
      role: "admin",
      id: crypto.randomUUID(),
      mode: "view",
    };

    super(ws, "admin", initialState);
    this.state = this.onConnect();
    this.id = this.state.id;
    this.addListener(cb);

    this.users = initialUsers;
  }

  onConnect(): AdminState {
    if (this.state) {
      return this.state;
    }

    const id = crypto.randomUUID();

    this.saveState({ role: "admin", id, mode: "view" });

    return this.state;
  }

  onAction(data: AdminMessage): void {
    switch (data.action) {
      case "mode":
        this.actionMode(data);
        break;
      case "join":
        this.actionJoin(data);
        break;
      case "leave":
        this.actionLeave(data);
        break;
      case "interaction":
        this.actionInteraction(data);
        break;
      case "device":
        this.actionDevice(data);
        break;
      case "displayname":
        this.actionDisplayname(data);
        break;

      case "position":
        this.actionPosition(data);
        break;

      case "uploaded":
        this.actionUploaded(data);
        break;

      case "connect":
        this.actionConnect(data);
        break;

      case "disconnect":
        this.actionDisconnect(data);
        break;
      default:
        break;
    }
  }

  updateUser(ws: WebSocket, user: UserState) {
    this.users.set(ws, user);

    this.saveUsersState();
  }

  private actionMode(data: AdminModeMessage): void {
    const newMode = data.mode;

    this.saveState({ mode: newMode });
  }

  private actionJoin(data: AdminJoinMessage) {
    const { user, ws } = data;

    this.users.set(ws, user);
    this.ws.send(json({ action: "join", ...user }));

    this.saveUsersState();
  }

  private actionLeave(data: AdminLeaveMessage) {
    const { ws } = data;

    const target = this.users.get(ws);

    if (!target) throw new BadRequestError("Invalid user");
    this.users.delete(ws);

    this.ws.send(json({ action: "leave", id: target.id }));

    this.saveUsersState();
  }

  private actionInteraction({ data }: AdminInteractionMessage) {
    this.ws.send(json({ ...data, action: "interaction" }));
  }

  private actionDevice(data: AdminDeviceMessage) {
    const { device, ws } = data;

    const user = this.getUser(ws);
    if (!user) throw new BadRequestError("Invalid user");

    user.onAction({ action: "device", device, ws });

    this.updateUser(user.ws, { ...user.getState(), ...device });

    this.ws.send(json({ action: "device", ...user.getState(), ...device }));
  }

  private actionDisplayname(data: AdminDisplaynameMessage) {
    const { displayname, ws } = data;
    const user = this.getUser(ws);

    user.onAction({ action: "displayname", displayname, ws });

    this.updateUser(user.ws, user.getState());

    this.ws.send(json({ action: "displayname", ...user.getState() }));
  }

  private actionPosition(data: AdminPositionMessage) {
    const { x, y, ws } = data;
    const user = this.getUser(ws);

    user.onAction({ action: "position", x, y, ws });

    this.updateUser(user.ws, user.getState());

    this.ws.send(json({ action: "position", ...user.getState() }));
  }

  private actionUploaded(data: AdminMessage) {
    this.ws.send(json({ ...data }));
  }

  getUser(ws: WebSocket): UserSession {
    const user = this.users.get(ws);

    if (!user) {
      throw new BadRequestError("Invalid user");
    }

    return new UserSession(
      ws,
      user,
      undefined,
      undefined,
      this.updateUser.bind(this)
    );
  }

  private saveUsersState() {
    const users = Array.from(this.users).map(([ws, user]) => {
      return { ws, user };
    });

    for (const { ws, user } of users) {
      ws.serializeAttachment({
        ...ws.deserializeAttachment(),
        ...user,
      });
    }
  }

  private actionConnect(data: AdminConnectMessage) {
    const { target, from, to, source, targetWs, sourceWs } = data;

    const targetUser = this.getUser(targetWs);
    const sourceUser = this.getUser(sourceWs);

    targetUser.onAction({
      action: "connect",
      target,
      from,
      to,
      source,
      sourceState: sourceUser.getState(),
    });
    sourceUser.onAction({
      action: "connect",
      target,
      from,
      to,
      source,
      sourceState: sourceUser.getState(),
    });

    this.ws.send(
      json({
        action: "connection",
        target: targetUser.getState(),
        source: sourceUser.getState(),
      })
    );
  }

  private actionDisconnect(data: AdminDisconnectMessage) {
    const { target, from, to, source, sourceWs, targetWs } = data;

    const targetUser = this.getUser(targetWs);
    const sourceUser = this.getUser(sourceWs);

    targetUser.onAction({
      action: "disconnect",
      target,
      from,
      to,
      source,
      sourceState: sourceUser.getState(),
    });
    sourceUser.onAction({
      action: "disconnect",
      target,
      from,
      to,
      source,
      sourceState: sourceUser.getState(),
    });

    this.ws.send(
      json({
        action: "connection",
        target: targetUser.getState(),
        source: sourceUser.getState(),
      })
    );
  }
}
