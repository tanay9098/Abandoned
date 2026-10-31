export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found`);
export const conflict = (message: string, code = "conflict") => new AppError(409, code, message);
export const badRequest = (message: string, details?: unknown) => new AppError(400, "invalid_request", message, details);
export const unauthorized = () => new AppError(401, "unauthorized", "Authentication required");
export const forbidden = (message = "Forbidden") => new AppError(403, "forbidden", message);
