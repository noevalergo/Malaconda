/**
 * HttpError: an error that is safe to show to the browser.
 *
 * Throw it from routes/services when the request is invalid or not allowed.
 * Any other error is treated as an internal error: the browser only sees a
 * generic message, and the details go to the server log.
 */
export class HttpError extends Error {
  /**
   * @param {number} status  HTTP status code (400, 401, 403, 404, 409, 503…)
   * @param {string} code    Stable machine-readable code, e.g. "PROMO_NOT_ELIGIBLE"
   * @param {string} message Human-readable message (English)
   */
  constructor(status, code, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code, message) => new HttpError(400, code, message);
export const unauthorized = (message = "Please verify your email first.") =>
  new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (code = "FORBIDDEN", message = "Not allowed.") =>
  new HttpError(403, code, message);
export const notFound = (message = "Not found.") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (code, message) => new HttpError(409, code, message);
export const unavailable = (code, message) => new HttpError(503, code, message);
