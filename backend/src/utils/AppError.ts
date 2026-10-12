export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: string[]
  ) {
    super(message);
  }

  static badRequest(message: string, errors?: string[]) {
    return new AppError(400, message, errors);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(401, message);
  }
  static forbidden(message = "You do not have access to this resource") {
    return new AppError(403, message);
  }
  static notFound(message = "Not found") {
    return new AppError(404, message);
  }
  static conflict(message: string) {
    return new AppError(409, message);
  }
  static notEligible(errors: string[]) {
    return new AppError(422, "Not eligible", errors);
  }
}
