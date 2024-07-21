import { z } from "zod";

export const direction = z.union([
  z.literal("left"),
  z.literal("right"),
  z.literal("top"),
  z.literal("bottom"),
]);

export const alignment = z.object({
  isLeft: z.boolean(),
  isRight: z.boolean(),
});

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  alignment,
});

export const windowSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export const displaynameSchema = z.object({
  displayname: z.string(),
});

export const changeDeviceSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  isStartDevice: z.boolean(),
});

export const modeSchema = z.object({
  mode: z.union([z.literal("view"), z.literal("connect")]),
});

export const overSchema = z.object({
  x: z.number(),
  y: z.number(),
  id: z.string(),
  direction,
  data: z.record(z.unknown()),
});

export const connectionSchema = z.object({
  from: direction,
  to: direction,
  source: z.string(),
  target: z.string(),
});

export type DeviceData = z.infer<typeof changeDeviceSchema>;
export type Mode = z.infer<typeof modeSchema>["mode"];
export type Alignment = z.infer<typeof alignment>;
export type PositionSchema = z.infer<typeof positionSchema>;
export type OverSchema = z.infer<typeof overSchema>;
export type Direction = z.infer<typeof direction>;
export type Connection = z.infer<typeof connectionSchema>;
