import { z } from "zod";

export const panelPosition = z.enum([
  "top left",
  "top right",
  "top center",
  "bottom left",
  "bottom right",
  "bottom center",
  "center left",
  "center right",
  "center",
  "initial",
]);

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  position: panelPosition,
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

export type DeviceData = z.infer<typeof changeDeviceSchema>;
export type Mode = z.infer<typeof modeSchema>["mode"];
export type Position = z.infer<typeof panelPosition>;
