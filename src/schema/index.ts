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
  isTop: z.boolean(),
  isBottom: z.boolean(),
});

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

// キースキーマ
const keySchema = z
  .string()
  .min(1, "1文字以上の文字列を入力してください。")
  .max(30, "30文字以下の文字列を入力してください。")
  .regex(/^[a-zA-Z0-9_]+$/, "英数字とアンダースコアのみ使用できます。");

// ラベルスキーマ
const labelSchema = z
  .string()
  .min(1, "1文字以上の文字列を入力してください。")
  .max(30, "30文字以下の文字列を入力してください。");

// カスタムスキーマ
const customSchema = z.union([
  z.object({
    type: z.literal("string"),
    defaultValue: z.string().default("初期値の文字列を入力してください。"),
    key: keySchema,
    label: labelSchema,
  }),
  z.object({
    type: z.literal("number"),
    defaultValue: z.number().default(0),
    key: keySchema,
    label: labelSchema,
  }),
  z.object({
    type: z.literal("boolean"),
    defaultValue: z.boolean().default(false),
    key: keySchema,
    label: labelSchema,
  }),
]);

// カスタム入力のタイプ定義
type CustomInput = z.infer<typeof customSchema>;
const customsSchema = z.array(customSchema);

type CustomsInput = z.infer<typeof customsSchema>;

export { customSchema, CustomInput, CustomsInput };
