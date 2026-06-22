import { DomainError } from "./domain-error";

export class GovernanceError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "GovernanceError";
  }
}
