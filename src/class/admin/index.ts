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
} from "@/types/admin";
import { UserState } from "@/types/users";
import { json } from "@/utils";

export class AdminSession
  extends BasicSession<AdminState, AdminActions, AdminMessage>
  implements Session<AdminState, AdminActions, AdminMessage>
{
  constructor(
    ws: WebSocket,
    cb: (ws: WebSocket, state: AdminState) => void,
    initialUsers: Map<WebSocket, UserState>
  ) {
    const initialState: AdminState = {
      role: "admin",
      id: crypto.randomUUID(),
      mode: "view",
      users: initialUsers,
    };
    super(ws, "admin", initialState);
    this.state = this.onConnect();
    this.id = this.state.id;
    this.addListener(cb);
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
      default:
        break;
    }
  }

  updateUser(ws: WebSocket, user: UserState) {
    this.state.users.set(ws, user);
  }

  private actionMode(data: AdminModeMessage): void {
    const newMode = data.mode;

    this.saveState({ mode: newMode });
  }

  private actionJoin(data: AdminJoinMessage) {
    const { user, ws } = data;

    this.state.users.set(ws, user);
    this.ws.send(json({ action: "join", ...user }));
  }

  private actionLeave(data: AdminLeaveMessage) {
    const { ws } = data;

    const target = this.state.users.get(ws);

    if (!target) throw new BadRequestError("Invalid user");
    this.state.users.delete(ws);

    this.ws.send(json({ action: "leave", id: target.id }));

    this.saveState({ users: this.state.users });
  }

  private actionInteraction({ data }: AdminInteractionMessage) {
    this.ws.send(json({ ...data, action: "interaction" }));
  }

  private actionDevice(data: AdminDeviceMessage) {
    const { device, ws } = data;

    const user = this.getUser(ws);

    user.onAction({ action: "device", device, ws });

    this.updateUser(user.ws, user.getState());

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
    const { x, y, ws } = data;

    const user = this.getUser(ws);

    user.onAction({ action: "position", x, y, ws });

    this.updateUser(user.ws, user.getState());

    this.ws.send(json({ action: "position", ...user.getState() }));
  }

  getUser(ws: WebSocket): UserSession {
    const user = this.state.users.get(ws);

    if (!user) {
      throw new BadRequestError("Invalid user");
    }

    return new UserSession(ws, user, undefined, this.updateUser.bind(this));
  }
}
