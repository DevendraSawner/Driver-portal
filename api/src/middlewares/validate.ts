import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/app-error.js";

type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors = [];

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (!parsed.success) {
        errors.push(...formatIssues(parsed.error.issues, "body"));
      } else {
        req.body = parsed.data;
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (!parsed.success) {
        errors.push(...formatIssues(parsed.error.issues, "query"));
      } else {
        Object.assign(req.query, parsed.data);
      }
    }

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (!parsed.success) {
        errors.push(...formatIssues(parsed.error.issues, "params"));
      } else {
        Object.assign(req.params, parsed.data);
      }
    }

    if (errors.length > 0) {
      next(new AppError(400, "Validation failed", errors));
      return;
    }

    next();
  };
}

function formatIssues(
  issues: { path: PropertyKey[]; message: string }[],
  source: string,
): { field: string; message: string }[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return {
      field: path ? `${source}.${path}` : source,
      message: issue.message,
    };
  });
}
