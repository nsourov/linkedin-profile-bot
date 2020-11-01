export class SessionExpired extends Error {
  constructor(message) {
    super(message);
    this.name = "SessionExpired";
    Error.captureStackTrace(this, SessionExpired);
  }
}
