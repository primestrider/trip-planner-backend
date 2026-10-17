import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { ErrorResponse } from "../models";
import { routePattern } from "../middleware/request-context.middleware";

/**
 * Prisma errors that describe a client mistake rather than a server fault
 */
const PRISMA_STATUS: Record<string, HttpStatus> = {
  // record to update / delete not found
  P2025: HttpStatus.NOT_FOUND,
  // unique constraint
  P2002: HttpStatus.CONFLICT,
  // foreign key constraint
  P2003: HttpStatus.CONFLICT
};

/**
 * Turns every error into the same JSON shape:
 * { statusCode, message, error, errors?, requestId, path }
 *
 * Unexpected errors are logged with their stack and answered with a
 * generic 500, so internal details never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { statusCode, message, errors } = this.describe(exception);

    if (statusCode >= 500) {
      this.logger.error("Unhandled error", {
        requestId: req.requestId,
        method: req.method,
        route: routePattern(req),
        error: exception instanceof Error ? exception.message : exception,
        stack: exception instanceof Error ? exception.stack : undefined
      });
    }

    const body: ErrorResponse = {
      statusCode,
      message,
      error: errorCode(statusCode),
      ...(errors && { errors }),
      requestId: req.requestId ?? null,
      path: req.path
    };

    res.status(statusCode).json(body);
  }

  private describe(exception: unknown): {
    statusCode: number;
    message: string;
    errors?: ErrorResponse["errors"];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === "string") {
        return { statusCode, message: response };
      }

      const record = response as {
        message?: string | string[];
        errors?: ErrorResponse["errors"];
      };
      const message = Array.isArray(record.message)
        ? record.message.join(", ")
        : (record.message ?? exception.message);

      return { statusCode, message, errors: record.errors };
    }

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      PRISMA_STATUS[exception.code]
    ) {
      const statusCode = PRISMA_STATUS[exception.code];
      return {
        statusCode,
        message:
          statusCode === HttpStatus.NOT_FOUND
            ? "Resource not found"
            : "Request conflicts with existing data"
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error"
    };
  }
}

/**
 * Stable machine-readable code, e.g. 404 -> "NOT_FOUND"
 */
function errorCode(statusCode: number): string {
  return HttpStatus[statusCode] ?? "ERROR";
}
