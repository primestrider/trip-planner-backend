import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard that protects the refresh token endpoint.
 * It validates the refresh token using the "jwt-refresh" strategy.
 */
@Injectable()
export class RefreshTokenGuard extends AuthGuard("jwt-refresh") {}
