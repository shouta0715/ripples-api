import { BasicSession } from "@/class/common";
import { BadRequestError } from "@/errors";
import { Session } from "@/models/sessions";
import { CustomInput, UserCustomInput } from "@/schema";
import { AssignedPosition } from "@/types/position";
import {
  ConnectMessage,
  CustomsMessage,
  DeviceMessage,
  DisconnectMessage,
  DisplaynameMessage,
  InteractionMessage,
  ModeMessage,
  OverMessage,
  PositionMessage,
  ResizeMessage,
  UploadedMessage,
  UserActions,
  UserMessage,
  UserState,
} from "@/types/users";
import {
  checkUUID,
  getNewAlignment,
  getRandomInitialPosition,
  json,
} from "@/utils";

export class UserSession
  extends BasicSession<UserState, UserActions, UserMessage>
  implements Session<UserState, UserActions, UserMessage>
{
  constructor(
    ws: WebSocket,
    initialState?: UserState,
    url?: URL,
    custom?: UserCustomInput,
    cb?: (ws: WebSocket, state: UserState) => void
  ) {
    super(ws, "user");
    this.state = initialState || this.onConnect(url, custom);
    this.id = this.state.id;
    if (cb) this.addListener(cb);
  }

  onConnect(url?: URL, custom?: UserCustomInput): UserState {
    const id = url?.pathname.split("/").pop();

    if (checkUUID(id) === false || !id) throw new BadRequestError("Invalid ID");

    const width = url?.searchParams.get("width");
    const height = url?.searchParams.get("height");

    if (!width || !height) throw new BadRequestError("Invalid size");

    const { x, y } = getRandomInitialPosition();

    const position: AssignedPosition = {
      startX: x,
      startY: y,
      endX: parseInt(width, 10),
      endY: parseInt(height, 10),
    };

    const state: UserState = {
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      assignPosition: position,
      displayname: id,
      id,
      role: "user",
      alignment: {
        isLeft: true,
        isRight: true,
        isBottom: true,
        isTop: true,
      },
      connections: [],
      isStartDevice: false,
      custom: custom || {},
    };

    this.saveState(state);

    return state;
  }

  onAction(data: UserMessage): void | Promise<void> {
    switch (data.action) {
      case "interaction":
        this.actionInteraction(data);
        break;
      case "resize":
        this.actionResize(data);
        break;
      case "mode":
        this.actionMode(data);
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

      case "over":
        this.actionOver(data);
        break;

      case "join":
        this.onJoin();
        break;

      case "customs":
        this.actionCustoms(data);
        break;
      default:
        throw new BadRequestError("Unknown action");
    }
  }

  getSession(): this {
    return this;
  }

  private actionInteraction(data: InteractionMessage): void {
    const { x, y, sender } = data;
    const { assignPosition } = this.state;
    const newX = x - assignPosition.startX + sender.assignPosition.startX;
    const newY = y - assignPosition.startY + sender.assignPosition.startY;

    this.ws.send(
      json<InteractionMessage>({
        ...data,
        x: newX,
        y: newY,
        id: sender.id,
      })
    );
  }

  private actionResize(data: ResizeMessage): void {
    const { width, height } = data;
    const { startX, startY } = this.state.assignPosition;

    const newPosition: AssignedPosition = {
      startX,
      startY,
      endX: width + startX,
      endY: height + startY,
    };

    this.saveState({ width, height, assignPosition: newPosition });

    this.ws.send(json({ action: "resize", ...this.state }));
  }

  private actionMode(data: ModeMessage): void {
    const { mode } = data;

    this.ws.send(json({ action: "mode", mode }));
  }

  private actionDevice(data: DeviceMessage): void {
    const { device } = data;
    const { x, y, width, height } = device;

    const newPosition: AssignedPosition = {
      startX: x,
      startY: y,
      endX: x + width,
      endY: y + height,
    };

    const state = { ...this.state, assignPosition: newPosition, ...device };

    this.saveState(state);

    this.ws.send(json({ action: "device", ...state }));
  }

  private actionDisplayname(data: DisplaynameMessage): void {
    const { displayname } = data;

    this.saveState({ displayname });
  }

  private actionPosition(data: PositionMessage): void {
    const { x, y } = data;
    const { width, height } = this.state;

    const newPosition: AssignedPosition = {
      startX: x,
      startY: y,
      endX: x + width,
      endY: y + height,
    };

    this.saveState({ assignPosition: newPosition });

    this.ws.send(
      json({
        ...this.state,
        ...data,
        action: "position",
      })
    );
  }

  private actionUploaded(data: UploadedMessage): void {
    this.ws.send(json({ action: "uploaded", id: data.id }));
  }

  private actionConnect(data: ConnectMessage): void {
    const { target, from, to, source, sourceState } = data;

    const isSource = this.state.id === source;
    const { alignment } = this.state;

    if (!isSource) {
      const newAlignment = getNewAlignment(alignment, "connect", to);

      this.saveState({ alignment: newAlignment });

      this.ws.send(
        json({ alignment: newAlignment, action: "connection", sourceState })
      );

      return;
    }

    const connection = { target, from, to, source };

    const newAlignment = getNewAlignment(alignment, "connect", from);

    this.saveState({
      connections: [...this.state.connections, connection],
      alignment: newAlignment,
    });

    this.ws.send(
      json({ alignment: newAlignment, action: "connection", sourceState })
    );
  }

  private actionDisconnect(data: DisconnectMessage): void {
    const { target, from, to, source, sourceState } = data;

    const isSource = this.state.id === source;

    if (!isSource) {
      const { alignment } = this.state;
      const newAlignment = getNewAlignment(alignment, "disconnect", to);

      this.saveState({ alignment: newAlignment });

      this.ws.send(
        json({
          alignment: newAlignment,
          action: "connection",
          sourceState,
        })
      );

      return;
    }

    const connections = this.state.connections.filter(
      (conn) =>
        conn.target !== target ||
        conn.from !== from ||
        conn.to !== to ||
        conn.source !== source
    );

    const { alignment } = this.state;

    const newAlignment = getNewAlignment(alignment, "disconnect", from);

    this.saveState({ connections, alignment: newAlignment });

    this.ws.send(
      json({
        alignment: newAlignment,
        action: "connection",
        sourceState,
      })
    );
  }

  private actionOver(data: OverMessage): void {
    const { x, y, sender } = data;
    const { assignPosition } = this.state;
    const newX = x - assignPosition.startX + sender.assignPosition.startX;
    const newY = y - assignPosition.startY + sender.assignPosition.startY;

    this.ws.send(
      json<OverMessage>({
        ...data,
        x: newX,
        y: newY,
        id: sender.id,
      })
    );
  }

  private onJoin(): void {
    this.ws.send(
      json({
        action: "join",
        state: this.state,
      })
    );
  }

  private actionCustoms(data: CustomsMessage): void {
    const { custom, trigger, key } = data;

    switch (trigger) {
      case "add":
        this.addCustom(custom);
        break;

      case "remove":
        this.removeCustom(key);
        break;

      default:
        break;
    }
  }

  private addCustom(custom: CustomInput): void {
    const newCustom: UserCustomInput = {
      [custom.key]: custom.defaultValue,
    };

    this.saveState({ custom: { ...this.state.custom, ...newCustom } });

    const device = {
      ...this.state,
      x: this.state.assignPosition.startX,
      y: this.state.assignPosition.startY,
      custom: { ...this.state.custom, ...newCustom },
    };

    this.actionDevice({ action: "device", device });
  }

  private removeCustom(key: string): void {
    const { [key]: _, ...newCustom } = this.state.custom;

    this.saveState({ custom: newCustom });

    const device = {
      ...this.state,
      x: this.state.assignPosition.startX,
      y: this.state.assignPosition.startY,
      custom: newCustom,
    };

    this.actionDevice({ action: "device", device });
  }
}
