import ms from "ms";
import type { StringValue } from "ms";

export function parseDuration(value: string): number {
  // runtime validation
  const duration = ms(value as StringValue);

  if (typeof duration !== "number") {
    throw new TypeError(`Invalid duration format: ${value}`);
  }

  return duration;
}
