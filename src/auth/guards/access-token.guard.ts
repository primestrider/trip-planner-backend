import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * AccessTokenGuard
 *
 * Guard responsible for protecting endpoints that require
 * a valid JWT access token.
 *
 * Behavior:
 * - All endpoints are protected by default.
 * - Endpoints marked with the `@Public()` decorator
 *   will bypass authentication.
 *
 * This guard delegates JWT validation to the
 * Passport strategy named `"jwt-access"`.
 */
@Injectable()
export class AccessTokenGuard extends AuthGuard("jwt-access") {
  /**
   * Reflector is used to read metadata set by decorators
   * (e.g. @Public) at runtime.
   */
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Determines whether the current request is allowed
   * to proceed to the route handler.
   *
   * This method is executed for every incoming request
   * before the controller method is invoked.
   *
   * Flow:
   * 1. Check if the route or controller is marked as public.
   * 2. If public, allow the request without authentication.
   * 3. Otherwise, validate the JWT access token using Passport.
   *
   * @param context ExecutionContext containing request information
   * @returns `true` if the request is allowed to continue
   * @throws UnauthorizedException if authentication fails
   */
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    /**
     * Check whether the route handler or controller
     * is marked as public via the @Public() decorator.
     *
     * Priority:
     * - Method-level metadata
     * - Controller-level metadata
     */
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    // Skip authentication for public endpoints
    if (isPublic) {
      return true;
    }

    /**
     * Delegate authentication to Passport's AuthGuard,
     * which will:
     * - Extract the access token from the Authorization header
     * - Validate the token signature and expiration
     * - Attach the decoded payload to `request.user`
     */
    return super.canActivate(context);
  }
}
