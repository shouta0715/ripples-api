import { BasicMessage, BasicState } from "@/models/sessions";
import {
  Alignment,
  CustomInput,
  DeviceData,
  Direction,
  Mode,
  UserCustomInput,
} from "@/schema";
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
  custom: UserCustomInput;
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
  | "join"
  | "customs";

export interface HeartbeatMessage extends BasicMessage<"heartbeat"> {
  type: "ping";
}
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
  sourceState: UserState;
}

export interface DisconnectMessage extends BasicMessage<"disconnect"> {
  target: string;
  from: Direction;
  to: Direction;
  source: string;
  sourceState: UserState;
}

export interface JoinMessage extends BasicMessage<"join"> {}

export interface CustomsMessage extends BasicMessage<"customs"> {
  custom: CustomInput;
  trigger: "add" | "remove";
  key: string;
}

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
  | JoinMessage
  | CustomsMessage;
