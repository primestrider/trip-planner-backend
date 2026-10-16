export interface BaseResponse<T = unknown> {
  statusCode: number;
  message?: string;
  data: T;
}

/**
 * Body of every error response
 */
export interface ErrorResponse {
  statusCode: number;
  message: string;
  // machine-readable code, e.g. "NOT_FOUND", "TOO_MANY_REQUESTS"
  error: string;
  // field errors, only for validation failures
  errors?: { field: string; messages: string[] }[];
  // same as the x-request-id response header; quote it when reporting a bug
  requestId: string | null;
  path: string;
}
