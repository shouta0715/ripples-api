import { UserSession } from "@/class/users";
import { BasicMessage, BasicState } from "@/models/sessions";
import { DeviceData, Mode } from "@/schema";
import { InteractionMessage } from "@/types/users";

export type AdminActions =
  | "mode"
  | "join"
  | "leave"
  | "interaction"
  | "device"
  | "displayname"
  | "position";

export type AdminState = {
  mode: Mode;
  users: Map<WebSocket, UserSession>;
} & BasicState;

export interface AdminModeMessage extends BasicMessage<"mode"> {
  action: "mode";
  mode: Mode;
}

export interface AdminJoinMessage extends BasicMessage<"join"> {
  user: UserSession;
  ws: WebSocket;
}

export interface AdminLeaveMessage extends BasicMessage<"leave"> {
  ws: WebSocket;
}

export interface AdminInteractionMessage extends BasicMessage<"interaction"> {
  data: InteractionMessage;
}

export interface AdminDeviceMessage extends BasicMessage<"device"> {
  device: DeviceData;
  id: string;
}

export interface AdminDisplaynameMessage extends BasicMessage<"displayname"> {
  displayname: string;
  id: string;
}

export interface AdminPositionMessage extends BasicMessage<"position"> {
  x: number;
  y: number;
  id: string;
}

export type AdminMessage =
  | AdminModeMessage
  | AdminJoinMessage
  | AdminLeaveMessage
  | AdminInteractionMessage
  | AdminDeviceMessage
  | AdminDisplaynameMessage
  | AdminPositionMessage;
