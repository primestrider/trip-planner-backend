import { randomUUID } from "crypto";
import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import type { AccessTokenPayload } from "src/auth/models";

/**
 * Route pattern of a request (e.g. `/invites/:token`), safe to log because
 * it never contains path parameters or query strings.
 * Unmatched routes (404) have no pattern, so the path without query is used.
 */
export function routePattern(req: Request): string {
  const route = (req.route as { path?: string } | undefined)?.path;
  return route ? `${req.baseUrl}${route}` : req.path;
}

// accept a caller's id only if it is short and plain, so it is safe to log
const INCOMING_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Gives every request an id and logs one line when it finishes.
 *
 * - Reuses a valid incoming `x-request-id` (e.g. from a load balancer),
 *   otherwise generates one, and echoes it in the response header.
 * - Logs the matched route pattern (`/invites/:token`) rather than the raw
 *   URL, so secrets in paths and query strings never reach the logs.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers["x-request-id"];
    const requestId =
      typeof incoming === "string" && INCOMING_ID_PATTERN.test(incoming)
        ? incoming
        : randomUUID();

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      this.logger.info("HTTP request", {
        requestId,
        method: req.method,
        route: routePattern(req),
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        userId: (req.user as AccessTokenPayload | undefined)?.sub
      });
    });

    next();
  }
}
