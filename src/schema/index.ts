import { z } from "zod";

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
});

export const modeSchema = z.object({
  mode: z.union([z.literal("view"), z.literal("connect")]),
});

export const overSchema = z.object({
  x: z.number(),
  y: z.number(),
  id: z.string(),
});

export type DeviceData = z.infer<typeof changeDeviceSchema>;
export type Mode = z.infer<typeof modeSchema>["mode"];
export type Alignment = z.infer<typeof alignment>;
export type PositionSchema = z.infer<typeof positionSchema>;
export type OverSchema = z.infer<typeof overSchema>;
