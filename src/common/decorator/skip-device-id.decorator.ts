import { SetMetadata } from "@nestjs/common";

export const SKIP_DEVICE_ID_KEY = "skipDeviceId";

/**
 * Marks a route or controller as not requiring the `x-device-id` header,
 * e.g. health checks and public pages opened from a browser.
 */
export const SkipDeviceId = () => SetMetadata(SKIP_DEVICE_ID_KEY, true);
