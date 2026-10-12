import { Schema } from "mongoose";

// Shared toJSON: expose `id`, hide `_id`/`__v`.
export function applyJsonTransform(schema: Schema, extraHidden: string[] = []): void {
  schema.set("toJSON", {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      delete ret.id_;
      extraHidden.forEach((key) => delete ret[key]);
      return ret;
    },
  });
}
