import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Response } from "express";
import { BaseResponse } from "src/common/models";

function isBaseResponse(value: unknown): value is BaseResponse {
  if (typeof value !== "object" || value === null) return false;
  if (!("statusCode" in value)) return false;

  const record = value as Record<string, unknown>;
  return typeof record.statusCode === "number";
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        const statusCode = response.statusCode;

        // kalau controller sudah return BaseResponse → jangan wrap ulang
        if (isBaseResponse(data)) {
          return data;
        }

        // default message berdasarkan status code
        const defaultMessage =
          statusCode >= 200 && statusCode < 300 ? "Success" : undefined;

        // kalau controller return object dan punya message → pakai
        if (typeof data === "object" && data !== null && "message" in data) {
          const record = data as Record<string, unknown>;

          return {
            statusCode,
            message:
              typeof record.message === "string"
                ? record.message
                : defaultMessage,
            data
          } satisfies BaseResponse;
        }

        return {
          statusCode,
          message: defaultMessage,
          data
        } satisfies BaseResponse;
      })
    );
  }
}
