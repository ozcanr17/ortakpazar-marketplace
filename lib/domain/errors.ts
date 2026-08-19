export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = "Bu işlem için yetkiniz yok") {
    super("FORBIDDEN", message);
  }
}
