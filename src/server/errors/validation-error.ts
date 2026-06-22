import { DomainError } from "./domain-error";

export class ValidationError extends DomainError {
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(code, message);
    this.name = "ValidationError";
    this.details = details;
  }
}
