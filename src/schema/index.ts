import { z } from "zod";

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
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

export type DeviceData = z.infer<typeof changeDeviceSchema>;
