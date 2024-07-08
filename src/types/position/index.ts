export type AssignedPosition = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type TopPosition = "top left" | "top right" | "top center";
export type BottomPosition = "bottom left" | "bottom right" | "bottom center";
export type LeftPosition = "top left" | "bottom left" | "center left";
export type RightPosition = "top right" | "bottom right" | "center right";

export type Position =
  | TopPosition
  | BottomPosition
  | LeftPosition
  | RightPosition
  | "center"
  | "initial";
