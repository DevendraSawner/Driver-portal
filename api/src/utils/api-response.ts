import type { Response } from "express";
import type { FieldError } from "./app-error.js";

export function sendSuccess<T>(res: Response, message: string, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors: FieldError[] = [],
): void {
  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}
