import { InternalServerError } from "@/errors";
import { Alignment, Direction } from "@/schema";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function checkUUID(id: string | undefined): boolean {
  if (!id) return false;

  return uuidRegex.test(id);
}

export const getRandomInitialPosition = () => {
  const x = Math.floor(Math.random() * 100);
  const y = Math.floor(Math.random() * 100);

  return { x, y };
};

export const json = <T>(data: T) => {
  return JSON.stringify(data);
};
export const parse = <T>(data: ArrayBuffer | string): T => {
  if (typeof data === "string") return JSON.parse(data);

  const decoder = new TextDecoder();

  return JSON.parse(decoder.decode(data));
};

const getDirectionToKey = (direction: Direction): keyof Alignment => {
  switch (direction) {
    case "left":
      return "isLeft";
    case "right":
      return "isRight";
    case "top":
      return "isTop";
    case "bottom":
      return "isBottom";
    default:
      throw new InternalServerError("Unknown direction");
  }
};

export const getNewAlignment = (
  alignment: Alignment,
  action: "connect" | "disconnect",
  direction: Direction
): Alignment => {
  switch (action) {
    case "connect":
      return {
        ...alignment,
        [getDirectionToKey(direction)]: false,
      };
    case "disconnect":
      return {
        ...alignment,
        [getDirectionToKey(direction)]: true,
      };
    default:
      throw new InternalServerError("Unknown action");
  }
};
