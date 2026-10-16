import { AccessTokenPayload } from "src/auth/models";

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
      requestId?: string;
      user?: AccessTokenPayload;
    }
  }
}

export {};
