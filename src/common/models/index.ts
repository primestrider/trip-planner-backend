export interface BaseResponse<T = unknown> {
  statusCode: number;
  message?: string;
  data: T;
}
