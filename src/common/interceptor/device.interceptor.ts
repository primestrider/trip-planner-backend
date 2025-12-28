import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException
} from "@nestjs/common";
import { Observable } from "rxjs";
import { Request } from "express";

/**
 * DeviceIdInterceptor is a global interceptor responsible for
 * extracting and validating the `x-device-id` header from incoming HTTP requests.
 *
 * Responsibilities:
 * - Ensure every request contains a valid `x-device-id` header
 * - Inject the resolved deviceId into the Express request object
 * - Prevent request processing if deviceId is missing or invalid
 *
 * This interceptor enables:
 * - Multi-device login/session management
 * - Per-device refresh token storage
 * - Logout per device / logout all devices
 *
 * Expected client behavior:
 * - Client must generate and persist a stable device identifier (UUID)
 * - Client must send it in the `x-device-id` HTTP header on every request
 *
 * Example header:
 * ```
 * x-device-id: 550e8400-e29b-41d4-a716-446655440000
 * ```
 *
 * After interception, the deviceId can be accessed via:
 * ```ts
 * request.deviceId
 * ```
 *
 * @throws {BadRequestException}
 * Thrown when the `x-device-id` header is missing or not a string
 */
@Injectable()
export class DeviceIdInterceptor implements NestInterceptor {
  /**
   * Intercepts incoming HTTP requests to extract and validate the device identifier.
   *
   * @param context Execution context containing request/response objects
   * @param next CallHandler to continue request processing
   * @returns Observable wrapping the downstream request handling
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();

    const deviceId = req.headers["x-device-id"];

    if (!deviceId || typeof deviceId !== "string") {
      throw new BadRequestException("Header X-DEVICE-ID required");
    }

    /**
     * Inject the validated deviceId into the request object
     * so it can be accessed in controllers, guards, and services.
     *
     * Type augmentation is handled via `express.d.ts`
     */
    req.deviceId = deviceId;

    return next.handle();
  }
}
