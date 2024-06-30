import { BasicMessage, BasicState } from "@/models/sessions";
import { DeviceData, Mode } from "@/schema";
import { AssignedPosition } from "@/types/position";

export type UserState = {
  width: number;
  height: number;
  displayname: string;
  assignPosition: AssignedPosition;
} & BasicState;

export type UserActions =
  | "interaction"
  | "resize"
  | "mode"
  | "device"
  | "displayname"
  | "position";

export interface InteractionMessage extends BasicMessage<"interaction"> {
  sender: UserState;
  x: number;
  y: number;
  id: string;
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

export type UserMessage =
  | InteractionMessage
  | ResizeMessage
  | ModeMessage
  | DeviceMessage
  | DisplaynameMessage
  | PositionMessage;
