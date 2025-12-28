import "express";

declare module "express" {
  export interface Request {
    deviceId?: string;
  }
}
