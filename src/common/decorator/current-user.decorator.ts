import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { AccessTokenPayload } from "../../auth/models";

export const CurrentUser = createParamDecorator<
  keyof AccessTokenPayload | undefined
>((data, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const user = request.user as AccessTokenPayload | undefined;

  if (!user) {
    return null;
  }

  if (data === undefined) {
    return user;
  }

  return user[data];
});
