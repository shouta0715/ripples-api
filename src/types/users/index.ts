import { BasicMessage, BasicState } from "@/models/sessions";
import { Alignment, DeviceData, Direction, Mode } from "@/schema";
import { AssignedPosition } from "@/types/position";

type Connection = {
  source: string;
  target: string;
  from: Direction;
  to: Direction;
};

export type UserState = {
  width: number;
  height: number;
  displayname: string;
  assignPosition: AssignedPosition;
  alignment: Alignment;
  connections: Connection[];
  isStartDevice: boolean;
} & BasicState;

export type UserActions =
  | "interaction"
  | "resize"
  | "mode"
  | "device"
  | "displayname"
  | "position"
  | "uploaded"
  | "connect"
  | "disconnect"
  | "over"
  | "join";

export interface InteractionMessage extends BasicMessage<"interaction"> {
  sender: UserState;
  x: number;
  y: number;
  id: string;
  [key: string]: unknown;
}

export interface OverMessage extends BasicMessage<"over"> {
  sender: UserState;
  x: number;
  y: number;
  id: string;
  target: string;
  from: Direction;
  to: Direction;
  source: string;
  [key: string]: unknown;
}

export interface ResizeMessage extends BasicMessage<"resize"> {
  width: number;
  height: number;
}

export interface ModeMessage extends BasicMessage<"mode"> {
  mode: Mode;
}

export interface DeviceMessage extends BasicMessage<"device"> {
  device: DeviceData;
}

export interface DisplaynameMessage extends BasicMessage<"displayname"> {
  displayname: string;
}

export interface PositionMessage extends BasicMessage<"position"> {
  x: number;
  y: number;
}

export interface UploadedMessage extends BasicMessage<"uploaded"> {
  id: string;
}

export interface ConnectMessage extends BasicMessage<"connect"> {
  target: string;
  from: Direction;
  to: Direction;
  source: string;
}

export interface DisconnectMessage extends BasicMessage<"disconnect"> {
  target: string;
  from: Direction;
  to: Direction;
  source: string;
}

export interface JoinMessage extends BasicMessage<"join"> {}

export type UserMessage =
  | InteractionMessage
  | ResizeMessage
  | ModeMessage
  | DeviceMessage
  | DisplaynameMessage
  | PositionMessage
  | UploadedMessage
  | ConnectMessage
  | DisconnectMessage
  | OverMessage
  | JoinMessage;
