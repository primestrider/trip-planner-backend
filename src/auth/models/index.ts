import { LoginUserDto, RegisterUserDto } from "../auth.validation";

/**
 * Context objects contain all data required
 * to execute an authentication-related operation.
 * This includes both user-provided credentials
 * and request-level metadata (e.g. deviceId).
 */

export type LoginContext = LoginUserDto & {
  deviceId: string;
};

export type RegisterContext = RegisterUserDto & {
  deviceId: string;
};

/**
 * Data required to persist a refresh token
 */
export type CreateRefreshToken = {
  userId: string;
  deviceId: string;
  tokenHash: string;
  expiresAt: Date;
};

/**
 * JWT payload embedded in access tokens
 */
export type AccessTokenPayload = {
  sub: string;
  username: string;
};

/**
 * Response returned to clients after authentication
 */
export type AuthUserResponse = {
  user: {
    id: string;
    username: string;
  };
  accessToken: string;
  refreshToken: string;
};
