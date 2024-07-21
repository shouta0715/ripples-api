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
  AdminConnectionMessage,
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

      case "connection":
        this.actionConnection(data);
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

    this.ws.send(json({ action: "device", ...user.getState() }));
  }

  private actionDisplayname(data: AdminDisplaynameMessage) {
    const { displayname, ws } = data;
    const user = this.getUser(ws);

    user.onAction({ action: "displayname", displayname, ws });

    this.updateUser(user.ws, user.getState());

    this.ws.send(json({ action: "displayname", ...user.getState() }));
  }

  private actionPosition(data: AdminPositionMessage) {
    const { x, y, ws, alignment } = data;

    const user = this.getUser(ws);

    user.onAction({ action: "position", x, y, ws, alignment });

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

    return new UserSession(ws, user, undefined, this.updateUser.bind(this));
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

  private actionConnection(data: AdminConnectionMessage) {
    const { target, from, to, source, ws } = data;

    const user = this.getUser(ws);

    user.onAction({ action: "connection", target, from, to, source });
  }
}
