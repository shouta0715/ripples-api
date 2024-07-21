import { BasicMessage, BasicState } from "@/models/sessions";
import { Alignment, DeviceData, Direction, Mode } from "@/schema";
import { InteractionMessage, UserState } from "@/types/users";

export type AdminActions =
  | "mode"
  | "join"
  | "leave"
  | "interaction"
  | "device"
  | "displayname"
  | "position"
  | "uploaded"
  | "connect";

export type AdminState = {
  mode: Mode;
} & BasicState;

export interface AdminModeMessage extends BasicMessage<"mode"> {
  action: "mode";
  mode: Mode;
}

export interface AdminJoinMessage extends BasicMessage<"join"> {
  user: UserState;
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
  ws: WebSocket;
}

export interface AdminDisplaynameMessage extends BasicMessage<"displayname"> {
  displayname: string;
  id: string;
  ws: WebSocket;
}

export interface AdminPositionMessage extends BasicMessage<"position"> {
  x: number;
  y: number;
  alignment: Alignment;
  id: string;
  ws: WebSocket;
}

export interface AdminUploadedMessage extends BasicMessage<"uploaded"> {
  id: string;
}

export interface AdminConnectMessage extends BasicMessage<"connect"> {
  target: string;
  from: Direction;
  to: Direction;
  source: string;
  ws: WebSocket;
}

export type AdminMessage =
  | AdminModeMessage
  | AdminJoinMessage
  | AdminLeaveMessage
  | AdminInteractionMessage
  | AdminDeviceMessage
  | AdminDisplaynameMessage
  | AdminPositionMessage
  | AdminUploadedMessage
  | AdminConnectMessage;
