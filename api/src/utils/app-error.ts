export type FieldError = {
  field?: string;
  message: string;
  code?: string;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly errors: FieldError[];

  constructor(statusCode: number, message: string, errors: FieldError[] = []) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
