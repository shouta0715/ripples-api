import { z } from "zod";

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const windowSchema = z.object({
  width: z.number(),
  height: z.number(),
});
